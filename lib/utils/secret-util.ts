import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const getSecret = async (secretName:string) => {
  const region = "us-east-1";

  const client = new SecretsManagerClient({ region });

  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);

  if (response.SecretString) {
    const secretValue = JSON.parse(response.SecretString);
    return secretValue;
  } else {
    throw new Error("Secret not found or in an unexpected format.");
  }
}

export {getSecret}