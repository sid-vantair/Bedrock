import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as cdk from "aws-cdk-lib";
import * as lambda  from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { HttpApi, HttpMethod, CorsHttpMethod} from '@aws-cdk/aws-apigatewayv2-alpha';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';


export class BedrockPocStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
  

  const boto3_layer = new lambda.LayerVersion(this, "boto3-mylayer",
      {
        layerVersionName: "python-lambda-layer-for-latest-boto3",
        code: lambda.Code.fromAsset('./lambda/layers/boto3-mylayer.zip'), 
        //compatibleRuntimes: [lambda.Runtime.PYTHON_3_11],
      }
    );  

  //defines an AWS Lambda resource
  const bedrock_text= new lambda.Function(this, "Bedrock_text_Handler", {
    // execution environment in python
    functionName: "Bedrock_text_model",
    runtime: lambda.Runtime.PYTHON_3_11,
    code: lambda.Code.fromAsset("lambda/Bedrock_text"), // code loaded from "lambda" directory
    handler: "bedrock_text.lambda_handler", // file is "bedrock_text", function is "lambda_handler",
    layers: [boto3_layer],
    timeout: Duration.seconds(120)
  });  
  
  //Add permissions to access Bedrock
  bedrock_text.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["bedrock:InvokeModel"],
      resources: ["*"]
    })
  );

  const bedrock_image = new lambda.Function(this, "Bedrock_image_Handler", {
    // execution environment in python
    functionName: "Bedrock_image_model",
    runtime: lambda.Runtime.PYTHON_3_11,
    code: lambda.Code.fromAsset("lambda/Bedrock_image"), // code loaded from "lambda" directory
    handler: "bedrock_image.lambda_handler", // file is "bedrock_text", function is "lambda_handler",
    layers: [boto3_layer],
    timeout: Duration.seconds(120)
  });  

  //Add permissions to access Bedrock
  bedrock_image.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["bedrock:InvokeModel"],
      resources: ["*"]
    })
  );

  //Add permissions to access S3
  bedrock_image.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["s3:GetObject", "s3:GetBucketLocation", "s3:PutObject"],
      resources: ["*"]
    })
    );    

    //create http api gateway integration
    const bedrockTextIntegration = new HttpLambdaIntegration('BedrockTextIntegration', bedrock_text);
    const bedrockImageIntegration = new HttpLambdaIntegration('BedrockImageIntegration', bedrock_image);

    //create http api gateway
    const httpApi = new HttpApi(this, 'HttpApi', {
      description: 'Bedrock API',
      apiName : 'Bedrock API',
      corsPreflight: {
        allowHeaders: [
          "Authorization",
          "Content-Type",
          "Origin",
          "X-Amz-Date",
          "X-Api-Key",
          "X-Amz-Security-Token",
          "X-Amz-User-Agent",
      ],
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.HEAD,
          CorsHttpMethod.OPTIONS,
          CorsHttpMethod.POST,
          CorsHttpMethod.PATCH,
        ],
        allowOrigins: ['*'],
        exposeHeaders: ["Access-Control-Allow-Origin"],
        maxAge: cdk.Duration.hours(1)
      }
      }
    );
  
    //Add routes to http api gateway
    httpApi.addRoutes({
            path: '/api/text',
            methods: [ HttpMethod.GET ],
            integration: bedrockTextIntegration,
          });
    
    httpApi.addRoutes({
            path: '/api/image',
            methods: [ HttpMethod.GET ],
            integration: bedrockImageIntegration,
          });

 //split http API endpoint
 const splitFunctionUrl = cdk.Fn.select(2, cdk.Fn.split('/', httpApi.apiEndpoint));

 // Creates a S3 bucket.
 const myBucket = new s3.Bucket(this, 'myBucket', {
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  autoDeleteObjects: true
 });
 
 // Creates a distribution from an S3 bucket.
 const distribution = new cloudfront.Distribution(this, 'myDist', {
 defaultBehavior: { origin: new origins.S3Origin(myBucket) },
 defaultRootObject: 'index.html',
 additionalBehaviors: {'/api/*': { origin: new origins.HttpOrigin(splitFunctionUrl) }},
 });

 //upload files to S3 bucket
 new s3deploy.BucketDeployment(this, 'DeployWithInvalidation', {
  sources: [s3deploy.Source.asset('./web-app/build')],
  destinationBucket: myBucket,
  distribution,
  distributionPaths: ['/*'],
  }); 
       
  new cdk.CfnOutput(this, 'CloudfrontUrl', { value: `https://${distribution.distributionDomainName}`})

  }
}
