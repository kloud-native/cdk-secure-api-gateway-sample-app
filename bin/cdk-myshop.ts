#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CdkMyshopStack } from '../lib/cdk-myshop-stack';
import { WafStack } from '../lib/waf-stack';

const app = new cdk.App();
const appStack = new CdkMyshopStack(app, 'CdkMyshopStack', {});
const wafStack = new WafStack(app, 'WafStack', {
  gatewayARN: appStack.apiGatewayARN
})
wafStack.addDependency(appStack);