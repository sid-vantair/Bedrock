import json
import boto3
import io
import base64
import os

bedrock = boto3.client('bedrock-runtime')
s3 = boto3.resource('s3')
s3_client = boto3.client('s3')


def lambda_handler(event, context):
    # TODO implement
    content = (json.dumps(event))
    processed_content =json.loads(content, parse_float=str)
    prompt = processed_content['queryStringParameters']['prompt']
    
    body = json.dumps({"text_prompts":[{"text":prompt}]})
    modelId = 'stability.stable-diffusion-xl'
    accept = 'application/json'
    contentType = 'application/json'

    response = bedrock.invoke_model(body=body, modelId=modelId, accept=accept, contentType=contentType)
    response_body = json.loads(response.get('body').read())

    print(response_body["result"])
    base_64_img_str = response_body["artifacts"][0].get("base64")
    print(f'base_64_img_str: {base_64_img_str}')
    base_64_decoded = base64.b64decode(base_64_img_str)
    print(f'base_64_decoded: {base_64_decoded}')
    IMAGE_BUCKET = 'iam-catpics-pon4fzv3yk18' #change to your bucket name
    IMAGE_NAME = "myImage.png"
    IMAGE_PATH = f'/tmp/{IMAGE_NAME}'
    obj = s3.Object(IMAGE_BUCKET, IMAGE_NAME)
    obj.put(Body=base_64_decoded)

    with open(IMAGE_PATH, "wb") as f:
        f.write(base_64_decoded)
    
    #get bucket location
    location = s3_client.get_bucket_location(Bucket=IMAGE_BUCKET)['LocationConstraint']
    #get object url
    image_url = "https://%s.s3-%s.amazonaws.com/%s" % (IMAGE_BUCKET,location, IMAGE_NAME)
    print(f'image_url: {image_url}')
        
    presigned_url = s3_client.generate_presigned_url(
        ClientMethod='get_object',
        Params={
            'Bucket': IMAGE_BUCKET,
            'Key': IMAGE_NAME
        },
        ExpiresIn=600 # expires in 10 minutes
    )
    
    body = {
        "image_url": presigned_url
     }
   
    return {
        
        "statusCode": 200,
        "headers": {
            "Cache-Control": "no-cache, no-store", 
            "Content-Type": "image/png",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "*"
        },
        "body": json.dumps(body),
        "isBase64Encoded": False
    }
    