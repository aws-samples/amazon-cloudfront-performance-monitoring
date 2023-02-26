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
import * as util from "util";
import * as path from "path";
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { aws_rum as rum } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as grafana from 'aws-cdk-lib/aws-grafana';
import { NagSuppressions } from 'cdk-nag';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { CloudwatchRumConstruct } from './cw-rum-construct';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { EventbridgeToStepfunctions, EventbridgeToStepfunctionsProps } from '@aws-solutions-constructs/aws-eventbridge-stepfunctions';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';

export interface CdkStackProps extends StackProps {
  // hostedZoneId: any;
  domainName: any;
  monitorDomainName: any;
  profile: any;
  sampleRate?: string;
  // deployStaging: boolean;
  // deployMultiCDN: boolean;
};

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: CdkStackProps) {
    super(scope, id, props);

    NagSuppressions.addStackSuppressions(this, [
      {
        id: 'AwsSolutions-IAM4',
        reason: 'S3 Bucket deployment is a standard CDK construct with visible controls to refine the policies.',
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'S3 Bucket deployment is a standard CDK construct with visible controls to refine the policies.',
      },
      {
        id: 'AwsSolutions-L1',
        reason: 'Lambda Functions being created is from CDK AwsCustomResource library'
      },
    ]);

    let s3Bucket = new s3.Bucket(this, "s3",
      {
        removalPolicy: RemovalPolicy.DESTROY,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        encryption: s3.BucketEncryption.S3_MANAGED,
        enforceSSL: true,
      });

    NagSuppressions.addResourceSuppressions(s3Bucket, [
      {
        id: 'AwsSolutions-S1',
        reason: 'S3 Bucket access logs may not be required as its a origin to CloudFront where we recommend to turn on logging.',
      },
    ]);
    const deployment = new s3deploy.BucketDeployment(this, "s3deploy", {
      sources: [s3deploy.Source.asset(path.join(__dirname, '/../../web-vitals/dist/'))],
      destinationBucket: s3Bucket,
      destinationKeyPrefix: "measure/",
    });

    let envProd = "prod";
    this.createResponseHeaderPolicy("default", envProd);

    let envStage = "stage";
    this.createResponseHeaderPolicy("default", envStage);

    let rumMonitorName = `${Stack.of(this).stackName}-cwrum`;

    const cloudwatchRum = new CloudwatchRumConstruct(this, rumMonitorName, {
      monitorDomain: props?.monitorDomainName,
      sampleRate: Number(props?.sampleRate),
      telemetries: ['errors', 'http'],
    });

    let datetimeConverterFunction = new lambda.Function(this, "DatetimeConverterFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 128,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../src/lambda-functions/datetime-converter/')),
    });

    const submitJob = new tasks.LambdaInvoke(this, 'Submit Job', {
      lambdaFunction: datetimeConverterFunction,
      // payload: sfn.TaskInput.fromJsonPathAt('$$.Execution.StartTime'),
      resultPath: "$",
    });

    const waitX = new sfn.Wait(this, 'Wait X Seconds', {
      time: sfn.WaitTime.duration(cdk.Duration.seconds(10)),
    });

    const cwlogQuery = new tasks.CallAwsService(this, 'cwlogQuery', {
      service: 'cloudwatchlogs',
      action: 'startQuery',
      parameters: {
        StartTime: sfn.JsonPath.numberAt('$.Payload.startTime'),
        EndTime: sfn.JsonPath.numberAt('$.Payload.endTime'),
        LogGroupName: cloudwatchRum.appMonitorCWLogGroup,
        QueryString: "fields metadata.countryCode as cc|stats count_distinct(cc) as count by cc |sort count desc|display cc",
      },

      additionalIamStatements: [new iam.PolicyStatement({
        resources: ["*"],
        actions: [
          "logs:StartQuery",
        ]
      })],
      iamResources: ["*"]
    });

    let extractCountryCodesFunction = new lambda.Function(this, "ExtractCountriesFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 128,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../src/lambda-functions/extract-countries/')),
    });

    const cwlogQueryResults = new tasks.CallAwsService(this, 'cwlogQueryResults', {
      service: 'cloudwatchlogs',
      action: 'getQueryResults',
      parameters: {
        QueryId: sfn.JsonPath.stringAt('$.QueryId'),
      },
      inputPath: "$",
      resultSelector: {
        cc: sfn.TaskInput.fromJsonPathAt('$.Results'),
      },
      additionalIamStatements: [new iam.PolicyStatement({
        resources: ["*"],
        actions: [
          "logs:GetQueryResults",
        ]
      })],
      iamResources: ["*"]
    });

    const extractCountryJob = new tasks.LambdaInvoke(this, 'Extract Country Codes', {
      lambdaFunction: extractCountryCodesFunction,
      payload: sfn.TaskInput.fromJsonPathAt('$'),
      outputPath: "$.Payload",
    });

    const map = new sfn.Map(this, 'Map State', {
      maxConcurrency: 1,
      itemsPath: '$.dimensions',
    });

    const putCWMetric = new tasks.CallAwsService(this, 'putCWMetric', {
      service: 'cloudwatch',
      action: 'putMetricData',
      parameters: {
        MetricData: [
          {
            "MetricName": "CountryCodes",
            "Dimensions.$": '$',
            "Value": 1
          }
        ],
        "Namespace": `Custom/RUM${Stack.of(this).stackName}`
      },
      additionalIamStatements: [new iam.PolicyStatement({
        resources: ["*"],
        actions: [
          "cloudwatch:PutMetricData",
        ]
      })],
      iamResources: ["*"]
    });

    map.iterator(putCWMetric);

    const definition = submitJob
      .next(cwlogQuery)
      .next(waitX)
      .next(cwlogQueryResults)
      .next(extractCountryJob)
      .next(map)

    // .(jobSuccess);

    const logGroup = new logs.LogGroup(this, 'FindCountriesLogGroup');

    // let findCountriesWorkflow = new sfn.StateMachine(this, 'FindCountries', {
    //   definition,
    //   timeout: cdk.Duration.minutes(5),
    //   logs: {
    //     destination: logGroup,
    //     level: sfn.LogLevel.ALL,
    //   },
    // });

    // const constructProps: EventbridgeToStepfunctionsProps = {
    //   stateMachineProps: {
    //     stateMachineName: `${Stack.of(this).stackName}-FindCountries`,
    //     definition: definition,
    //     timeout: cdk.Duration.minutes(5),
    //     logs: {
    //       destination: logGroup,
    //       level: sfn.LogLevel.ALL,
    //     },
    //   },
    //   eventRuleProps: {
    //     schedule: events.Schedule.rate(cdk.Duration.minutes(60))
    //   }
    // };

    let findCountries = new sfn.StateMachine(this, 'FindCountries', {
      definition,
      timeout: cdk.Duration.minutes(5),
      logs: {
        destination: logGroup,
        level: sfn.LogLevel.ALL,
      },
    });

    new Rule(this, "FindCountriesScheduler", {
      schedule: Schedule.rate(cdk.Duration.days(1)),
      targets: [new targets.SfnStateMachine(findCountries)],
    });

    // const eventBridgeStepFunction = new EventbridgeToStepfunctions(this, 'FindCountries', constructProps);

    NagSuppressions.addResourceSuppressions(findCountries, [
      {
        id: 'AwsSolutions-SF2',
        reason: 'This workflow fetches the recent country list from CloudWatch Logs.',
      },
    ]);

    // let identityPool = new cognito.CfnIdentityPool(this, 'rum-idp', {
    //   identityPoolName: `${Stack.of(this).stackName}-rum-idp`,
    //   allowUnauthenticatedIdentities: true,
    //   allowClassicFlow: true,
    // });

    // NagSuppressions.addResourceSuppressions(identityPool, [
    //   {
    //     id: 'AwsSolutions-COG7',
    //     reason: 'CloudWatch RUM needs Cognito Identity Pool with unauthenticated access',
    //   },
    // ]);


    // let idpRole = new iam.Role(this, "idp-role", {
    //   assumedBy: new iam.FederatedPrincipal('cognito-identity.amazonaws.com'),
    //   inlinePolicies: {
    //     customPolicy1: new iam.PolicyDocument({
    //       statements: [
    //         new iam.PolicyStatement({
    //           resources: [`arn:aws:rum:${Stack.of(this).region}:${Stack.of(this).account}:appmonitor/${rumMonitorName}`],
    //           actions: ["rum:PutRumEvents"],
    //         }),
    //       ]
    //     }),
    //   },
    // });

    // idpRole.assumeRolePolicy?.addStatements(
    //   new iam.PolicyStatement({
    //     actions: ['sts:AssumeRoleWithWebIdentity'],
    //     principals: [new iam.FederatedPrincipal('cognito-identity.amazonaws.com')],
    //     conditions:
    //     {
    //       "StringEquals": {
    //         "cognito-identity.amazonaws.com:aud": identityPool.ref
    //       },
    //       "ForAnyValue:StringLike": {
    //         "cognito-identity.amazonaws.com:amr": "unauthenticated"
    //       }
    //     }
    //   })
    // );

    // new cognito.CfnIdentityPoolRoleAttachment(this, "idp-role-attachment", {
    //   identityPoolId: identityPool.ref,
    //   roles: {
    //     'unauthenticated': idpRole.roleArn,
    //   }
    // });

    // let cfnAppMonitor = new rum.CfnAppMonitor(this, 'rum', {
    //   domain: props?.monitorDomainName,
    //   name: rumMonitorName,
    //   appMonitorConfiguration: {
    //     allowCookies: true,
    //     identityPoolId: identityPool.ref,
    //     sessionSampleRate: 0.1,
    //     telemetries: ['http', 'errors'],
    //   },
    //   cwLogEnabled: true,
    // });

    // this.setCustomEventsEnabled(cfnAppMonitor, true);
    this.createGrafanaWorkspace();
  }

  setCustomEventsEnabled(appMonitor: rum.CfnAppMonitor,
    isEnabled: boolean) {
    // Setting custom events is not yet supported through CDK
    const appMonitorArn = `arn:aws:rum:${Stack.of(this).region}:${Stack.of(this).account}:appmonitor/${appMonitor.name}`;
    const awsRumSdkCall: cr.AwsSdkCall = {
      service: 'RUM',
      action: 'updateAppMonitor',
      parameters: {
        Name: appMonitor.name,
        CustomEvents: { Status: isEnabled ? 'ENABLED' : 'DISABLED' },
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

  createGrafanaWorkspace() {
    let role = new iam.Role(this, "grafana-role1", {
      assumedBy: new iam.ServicePrincipal('grafana.amazonaws.com', {
        conditions:
        {
          "StringEquals": {
            "aws:SourceAccount": `${Stack.of(this).account}`
          },
          "StringLike": {
            "aws:SourceArn": `arn:aws:grafana:${Stack.of(this).region}:${Stack.of(this).account}:/workspaces/*`
          }
        }
      }),
      inlinePolicies: {
        customPolicy1: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              resources: ['*'],
              // resources: [`arn:aws:logs:${Stack.of(this).region}:${Stack.of(this).account}:log-group:/aws/vendedlogs/*:*`],
              effect: iam.Effect.ALLOW,
              actions: ["cloudwatch:DescribeAlarmsForMetric",
                "cloudwatch:DescribeAlarmHistory",
                "cloudwatch:DescribeAlarms",
                "cloudwatch:ListMetrics",
                "cloudwatch:GetMetricStatistics",
                "cloudwatch:GetMetricData",
                "cloudwatch:GetInsightRuleReport"],
            }),
            new iam.PolicyStatement({
              resources: ['*'],
              // resources: [`arn:aws:logs:${Stack.of(this).region}:${Stack.of(this).account}:log-group:/aws/vendedlogs/*:*`],
              effect: iam.Effect.ALLOW,
              actions: ["logs:DescribeLogGroups",
                "logs:GetLogGroupFields",
                "logs:StartQuery",
                "logs:StopQuery",
                "logs:GetQueryResults",
                "logs:GetLogEvents"]
            }),
            new iam.PolicyStatement({
              resources: ['*'],
              effect: iam.Effect.ALLOW,
              actions: ["ec2:DescribeTags",
                "ec2:DescribeInstances",
                "ec2:DescribeRegions"]
            }),
            new iam.PolicyStatement({
              resources: ['*'],
              effect: iam.Effect.ALLOW,
              actions: ["tag:GetResources"]
            }),
          ]
        }),
      },
    });

    NagSuppressions.addResourceSuppressions(role, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'The role created per requirement specified in for CloudWatch Logs https://docs.aws.amazon.com/grafana/latest/userguide/AMG-manage-permissions.html',
      },
    ]);

    return new grafana.CfnWorkspace(this, util.format("%s-%s", Stack.of(this).stackName, "workspace"),
      {
        name: util.format("%s-%s", Stack.of(this).stackName, "workspace"),
        dataSources: ["CLOUDWATCH"],
        accountAccessType: "CURRENT_ACCOUNT",
        authenticationProviders: ["AWS_SSO"],
        permissionType: "SERVICE_MANAGED",
        roleArn: role.roleArn
      });
  }

  createResponseHeaderPolicy(name: string, stage?: string | undefined, pattern?: string | undefined, originId?: string | undefined): cloudfront.CfnResponseHeadersPolicy {
    let labels = '';
    if (originId) {
      labels += `origin;desc="${originId}"`;
    }
    if (stage) {
      labels += `stage;desc="${stage}"`;
    }
    if (pattern) {
      labels += `behavior;desc="${pattern}"`
    }

    return new cloudfront.CfnResponseHeadersPolicy(this, util.format("%s-%s-%s-cfn", Stack.of(this).stackName, name, stage), {
      responseHeadersPolicyConfig: {
        name: util.format("%s-%s-%s", Stack.of(this).stackName, name, stage),
        corsConfig: {
          accessControlAllowCredentials: false,
          accessControlAllowHeaders: {
            items: ['*'],
          },
          accessControlAllowMethods: {
            items: ['GET', 'POST'],
          },
          accessControlAllowOrigins: {
            items: ['*'],
          },
          originOverride: false,
        },
        customHeadersConfig: {
          items: [
            {
              header: 'Timing-Allow-Origin',
              override: false,
              value: '*',
            },
            {
              header: 'Server-Timing',
              override: false,
              value: labels,
            },
          ],
        },
        serverTimingHeadersConfig: {
          enabled: true,
          // the properties below are optional
          samplingRate: 100,
        },
      },
    });
  }
}