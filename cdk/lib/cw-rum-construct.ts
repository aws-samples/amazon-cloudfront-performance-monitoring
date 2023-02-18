/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { aws_rum as cwrum, Stack } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NagSuppressions } from 'cdk-nag';
import * as cr from 'aws-cdk-lib/custom-resources';

export type Telemetries = 'errors' | 'performance' | 'http';

export interface CloudwatchRUMProps {
    // region: string;
    // accountID: string;
    // stage: string;
    monitorDomain: string;
    sampleRate?: number;
    // physicalResourceId: string;
    telemetries?: Telemetries[];
}

export class CloudwatchRumConstruct extends Construct {
    public unauthenticatedRoleArn: string;
    public readonly rumMonitor: cwrum.CfnAppMonitor;
    public readonly identityPoolId: string;
    public readonly appMonitorId: string;
    public readonly appMonitorCWLogGroup: string;
    private rumMonitorArn: string;

    constructor(scope: Construct, id: string, props: CloudwatchRUMProps) {
        super(scope, id);
        this.unauthenticatedRoleArn = '';
        this.rumMonitorArn = `arn:aws:rum:${Stack.of(this).region}:${Stack.of(this).account}:appmonitor/${id}`;
        this.identityPoolId = this.createIdentityPool(id);
        this.rumMonitor = this.createRumMonitor(id, props);
        let cwRUM = this.getAppMonitorId(this.rumMonitor.ref);
        this.appMonitorId = cwRUM[0];
        this.appMonitorCWLogGroup = cwRUM[1]
        this.enableCustomEvents(this.rumMonitor);
    }

    private createRumMonitor(id: string, props: CloudwatchRUMProps): cwrum.CfnAppMonitor {
        const { sampleRate, monitorDomain, telemetries } = props;
        const monitor = new cwrum.CfnAppMonitor(this, id, {
            name: id,
            appMonitorConfiguration: {
                allowCookies: true,
                // enableXRay: true,
                sessionSampleRate: sampleRate ? sampleRate : 0.1,
                telemetries: telemetries || ['errors', 'performance', 'http'],
                guestRoleArn: this.unauthenticatedRoleArn,
                identityPoolId: this.identityPoolId,
            },
            cwLogEnabled: true,
            domain: monitorDomain,
        });
        return monitor;
    }

    private getAppMonitorId(physicalResourceId: string): string[] {
        const awsRUMSDKCall: cr.AwsSdkCall = {
            service: 'RUM',
            action: 'getAppMonitor',
            parameters: { Name: this.rumMonitor.name },
            physicalResourceId: cr.PhysicalResourceId.of(physicalResourceId)
        };

        const customResource = new cr.AwsCustomResource(this, 'Custom::GetAppMonitorId', {
            policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
                resources: [this.rumMonitorArn]
            }),
            installLatestAwsSdk: true,
            onCreate: awsRUMSDKCall,
            onUpdate: awsRUMSDKCall,
            functionName: 'GetAppMonitor'
        });

        customResource.node.addDependency(this.rumMonitor);
        let response = []
        response.push(customResource.getResponseField('AppMonitor.Id'));
        response.push(customResource.getResponseField('AppMonitor.DataStorage.CwLog.CwLogGroup'))
        return response;
    }

    private enableCustomEvents(appMonitor: cwrum.CfnAppMonitor) {
        // Setting custom events is not yet supported through CDK
        const appMonitorArn = `arn:aws:rum:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:appmonitor/${appMonitor.name}`;
        const awsRumSdkCall: cr.AwsSdkCall = {
            service: 'RUM',
            action: 'updateAppMonitor',
            parameters: {
                Name: appMonitor.name,
                CustomEvents: { Status: 'ENABLED' },
            },
            physicalResourceId: cr.PhysicalResourceId.of(appMonitor.ref),
        };

        const customResource = new cr.AwsCustomResource(this, 'SetAppMonitorCustomEvents', {
            policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
                resources: [appMonitorArn],
            }),
            installLatestAwsSdk: true,
            onCreate: awsRumSdkCall,
            onUpdate: awsRumSdkCall,
        });

        customResource.node.addDependency(appMonitor);
    };

    private createIdentityPool(id: string): string {
        const identityPool = new cognito.CfnIdentityPool(this, `${id}-IdentityPool`, {
            identityPoolName: `${id}-RUM-IdentityPool`,
            allowUnauthenticatedIdentities: true
        });

        NagSuppressions.addResourceSuppressions(identityPool, [
            {
                id: 'AwsSolutions-COG7',
                reason: 'CloudWatch RUM needs Cognito Identity Pool with unauthenticated access',
            },
        ]);

        const identityPoolId = identityPool.ref;

        /**
         * Role associated with RUM users.
         * RUM can only accept requests from our domain and the only permissions this role gives is rum:PutRumEvents
         */
        const unauthenticatedRole = new iam.Role(this, `${id}-RUMCognitoUnauthenticatedRole`, {
            assumedBy: new iam.FederatedPrincipal(
                'cognito-identity.amazonaws.com',
                {
                    StringEquals: {
                        'cognito-identity.amazonaws.com:aud': identityPoolId
                    },
                    'ForAnyValue:StringLike': {
                        'cognito-identity.amazonaws.com:amr': 'unauthenticated'
                    }
                },
                'sts:AssumeRoleWithWebIdentity'
            ),
            inlinePolicies: {
                PutRumEvents: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: ['rum:PutRumEvents'],
                            resources: [this.rumMonitorArn]
                        })
                    ]
                })
            }
        });
        this.unauthenticatedRoleArn = unauthenticatedRole.roleArn;

        const roleAttachment = new cognito.CfnIdentityPoolRoleAttachment(this, `${id}-RUM-IdentityPoolRoleAttachment`, {
            identityPoolId: identityPoolId,
            roles: {
                unauthenticated: unauthenticatedRole.roleArn
            }
        });
        roleAttachment.node.addDependency(identityPool);
        return identityPoolId;
    }
}