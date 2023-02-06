#!/usr/bin/env bash

export AWS_PROFILE=""
export HOSTEDZONE_ID=''
export DOMAIN_NAME=''
export CDK_DEPLOY_REGION=''
npx cdk bootstrap --profile $AWS_PROFILE
npx cdk destroy --profile $AWS_PROFILE