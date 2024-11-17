// import { APIGatewayTokenAuthorizerEvent, PolicyDocument, AuthResponse, StatementEffect } from 'aws-lambda';
// import * as jwt from 'jsonwebtoken';
// import axios from 'axios';

// var jwkToPem = require('jwk-to-pem');

// const region = process.env.AWS_REGION;
// const userPoolId = process.env.USER_POOL_ID; 

// const cognitoIssuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

// const generatePolicy = (principalId: string, effect: string, resource: string): AuthResponse => {
//   const policyDocument: PolicyDocument = {
//     Version: '2012-10-17',
//     Statement: [
//       {
//         Action: 'execute-api:Invoke',
//         Effect: effect as StatementEffect,
//         Resource: resource,
//       },
//     ],
//   };

//   return {
//     principalId,
//     policyDocument,
//   };
// };

// export const handler = async (event: APIGatewayTokenAuthorizerEvent): Promise<AuthResponse> => {
//   const token = event.authorizationToken;
//   if (!token) {
//     throw new Error('Unauthorized');
//   }

//   console.log("USER POOL ID: ", userPoolId);

//   try {
//     // Get Cognito JWKs
//     const jwks = await axios.get(`${cognitoIssuer}/.well-known/jwks.json`);
//     const jwk = jwks.data.keys[0];

//     // Convert JWK to PEM
//     const pem = jwkToPem(jwk);
    
//     console.log("TOKEN: ", token);

//     // Verify the token
//     const decodedToken = jwt.verify(token, pem, { algorithms: ['RS256'] });

//     console.log("DECODED TOKEN: ", decodedToken);

//     // Return a policy that allows access
//     return generatePolicy(decodedToken.sub as string, 'Allow', event.methodArn);
//   } catch (error) {
//     console.error('Token verification failed:', error);
//     throw new Error('Unauthorized');
//   }
// };

import { APIGatewayAuthorizerResult, APIGatewayRequestAuthorizerEvent, APIGatewayTokenAuthorizerEvent, Context } from 'aws-lambda';
import * as jwt from 'jsonwebtoken'; // Updated import for jsonwebtoken
import jwksClient from 'jwks-rsa';
import { JwtHeader, VerifyOptions, SigningKeyCallback } from 'jsonwebtoken';
import { Effect } from 'aws-cdk-lib/aws-iam';

const region = process.env.AWS_REGION;
const userPoolId = process.env.USER_POOL_ID; 
const srcIdentSecret = process.env.SRC_IDENT;

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

  console.log("CustomHeader: ", customHeader, " SRC IDENT Secret: ", srcIdentSecret);
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
