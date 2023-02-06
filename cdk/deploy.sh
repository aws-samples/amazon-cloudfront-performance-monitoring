#!/usr/bin/env bash
# the AWS CLI profile name to be used.
export AWS_PROFILE=''
# name of domain to add RUM
export MONITOR_DOMAIN_NAME=''
# AWS Region to deploy the solution
export CDK_DEPLOY_REGION='us-east-1'
# npm audit fix
cd ../web-vitals && npm install && npm audit fix && npm run build
cd ../cdk
npm install
npx cdk bootstrap --profile $AWS_PROFILE
npx cdk synth
npx cdk deploy --profile $AWS_PROFILE --require-approval never