#!/usr/bin/env bash
# the AWS CLI profile name to be used.
export AWS_PROFILE='demoportal'
# name of domain to add RUM
export MONITOR_DOMAIN_NAME='dkbq317oor7m.cloudfront.net'
# AWS Region to deploy the solution.Select region where CloudWatch RUM is present
export CDK_DEPLOY_REGION='us-east-1'

# CW RUM sample rate, range between 0 and 1. setting a lower value reduces the
# events emitted by viewer sessions and cut cost.
export SAMPLE_RATE=0.1

# npm audit fix
# cd ../web-vitals && npm install && npm audit fix && npm run build
# cd ../cdk
# npm install
# npx cdk bootstrap --profile $AWS_PROFILE
# npx cdk synth
npx cdk deploy --profile $AWS_PROFILE --require-approval never