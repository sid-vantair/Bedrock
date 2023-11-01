#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BedrockPocStack } from '../lib/bedrock-poc-stack';

const app = new cdk.App();
new BedrockPocStack(app, 'BedrockPocStack');
