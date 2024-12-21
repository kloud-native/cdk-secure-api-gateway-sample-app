import { APIGatewayAuthorizerResult, APIGatewayRequestAuthorizerEvent, APIGatewayTokenAuthorizerEvent, Context } from 'aws-lambda';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { JwtHeader, VerifyOptions, SigningKeyCallback } from 'jsonwebtoken';
import { Effect } from 'aws-cdk-lib/aws-iam';
// const SecretUtil = require('../utils/secret-util');
import { getSecret } from '../utils/secret-util';

const region = process.env.AWS_REGION;
const userPoolId = process.env.USER_POOL_ID; 
const SRC_IDENT_SECRET = "SrcIdent";

const client = jwksClient({
  jwksUri: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`
});

const getKey = (header: JwtHeader, callback: SigningKeyCallback) => {
  client.getSigningKey(header.kid, (err, key) => {
    const signingKey = key?.getPublicKey();
    callback(err, signingKey);
  });
};

const verifyToken = (token: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const options: VerifyOptions = {
      algorithms: ['RS256'],
    };

    jwt.verify(token, getKey, options, (err, decoded) => {
      if (err) {
        return reject(`Unauthorized: ${err.message}`);
      }
      resolve(decoded);
    });
  });
};

export const handler = async (
  event: APIGatewayRequestAuthorizerEvent,
  context: Context
): Promise<APIGatewayAuthorizerResult> => {
  console.log("EVENT: ", event);
  
  const token = event.headers?.['Authorization']?.split(' ')[1]; // Extract Bearer token
  const customHeader = event.headers?.['src-ident'];

  if (!token || !customHeader) {
    throw new Error('Unauthorized: Missing token or custom header');
  }

  const srcIdentSecret = await getSecret(SRC_IDENT_SECRET);
  const srcIdentString = srcIdentSecret['src-ident'];
  console.log("CustomHeader: ", customHeader, " SRC IDENT Secret: ", srcIdentString);
  try {
    const decoded = await verifyToken(token);

    const principalId = decoded.sub; // Cognito User ID from token
    const policy = generatePolicy(principalId, Effect.ALLOW, event.methodArn);

    return policy;
  } catch (error) {
    console.error(error);
    throw new Error('Unauthorized');
  }
};

const generatePolicy = (
  principalId: string,
  effect: Effect,
  resource: string
): APIGatewayAuthorizerResult => {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };
};
