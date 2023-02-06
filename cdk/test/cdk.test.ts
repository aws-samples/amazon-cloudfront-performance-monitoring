#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CdkStack, CdkStackProps } from '../lib/cdk-stack';
import { AwsSolutionsChecks } from 'cdk-nag';
import { Aspects } from 'aws-cdk-lib';

const app = new cdk.App();
// Add the cdk-nag AwsSolutions Pack with extra verbose logging enabled.

// Aspects.of(app).add(new AwsSolutionsChecks());

new CdkStack(app, 'CdkStack', {
    env: { account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION },
    terminationProtection: true,
    // hostedZoneId: process.env.HOSTEDZONE_ID,
    // domainName: process.env.DOMAIN_NAME,
    monitorDomainName: process.env.MONITOR_DOMAIN_NAME,
    // deployStaging: process.env.DEPLOY_STAGING == "TRUE" ? true : false,
    // deployMultiCDN: process.env.DEPLOY_MULTICDN == "TRUE" ? true : false,
    organizationalUnitId: process.env.ORG_UNIT_ID,
} as CdkStackProps);

Aspects.of(app).add(new AwsSolutionsChecks());
