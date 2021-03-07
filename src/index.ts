import type {AWSError} from 'aws-sdk';
import {SecretsManager} from 'aws-sdk';

export interface Secret {
    /* eslint-disable @typescript-eslint/naming-convention */
    /**
     * The decrypted part of the protected secret information that was originally provided
     * as binary data in the form of a byte array.
     * The response parameter represents the binary data as a base64-encoded string.
     * This parameter is not used if the secret is created by the Secrets Manager console.
     * If you store custom information in this field of the secret, then you must code your
     * Lambda rotation function to parse and interpret whatever you store in the SecretString
     * or SecretBinary fields.
     */
    SecretBinary?: SecretsManager.SecretBinaryType;

    /**
     * The decrypted part of the protected secret information that was originally provided as a string.
     * If you create this secret by using the Secrets Manager console then only the SecretString parameter contains data.
     * Secrets Manager stores the information as a JSON structure of key/value pairs that the Lambda rotation function
     * knows how to parse.
     * If you store custom information in the secret by using the CreateSecret, UpdateSecret, or PutSecretValue API
     * operations instead of the Secrets Manager console, or by using the Other secret type in the console, then you
     * must code your Lambda rotation function to parse and interpret those values.
     */
    SecretString?: SecretsManager.SecretStringType;
    /* eslint-enable @typescript-eslint/naming-convention */
}

export interface Result {
    message?: string;
    secret?: Secret;
}

export enum VersionStage {
    CURRENT = 'AWSCURRENT',
    PENDING = 'AWSPENDING',
    PREVIOUS = 'AWSPREVIOUS',
}

export enum RotationStep {
    CREATE_SECRET = 'createSecret',
    SET_SECRET = 'setSecret',
    TEST_SECRET = 'testSecret',
    FINISH_SECRET = 'finishSecret',
}

export interface RotationEvent {
    /* eslint-disable @typescript-eslint/naming-convention */
    /**
     * Specifies the part of the rotation function behavior to invoke.
     * Each of the different values identifies a step of the rotation process.
     * The separation into independently invoked steps enables the AWS Secrets Manager team to add additional
     * functionality to occur between steps.
     */
    Step: RotationStep;

    /**
     * The ID or Amazon Resource Name(ARN) for the secret to rotate.
     * Secrets Manager assigns an ARN to every secret when you initially create the secret.
     * The version rotating automatically becomes the default version labeled AWSCURRENT.
     */
    SecretId: string;

    /**
     * A string Secrets Manager provides to the Lambda function.
     * You must pass the string to any Secrets Manager APIs you call from within the Lambda function.
     * Secrets Manager uses this token to ensure the idempotency of requests during any required retries caused
     * by failures of individual calls.
     * This value is a UUID-type value to ensure uniqueness within the specified secret.
     * This value becomes the SecretVersionId of the new version of the secret.
     */
    ClientRequestToken: string;
    /* eslint-enable @typescript-eslint/naming-convention */
}

export class Rotation {
    private readonly event: RotationEvent;

    private readonly secretsManager: SecretsManager;

    public constructor(event: RotationEvent, options?: SecretsManager.Types.ClientConfiguration) {
        this.event = event;
        this.secretsManager = new SecretsManager(options);

        this.secretsManager.describeSecret({
            /* eslint-disable @typescript-eslint/naming-convention */
            SecretId: this.event.SecretId,
            /* eslint-enable @typescript-eslint/naming-convention */
        }, (err, data) => {
            /* eslint-disable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/strict-boolean-expressions */
            if (err) throw err;
            if (!data.RotationEnabled) {
                throw new Error(`Secret ${this.event.SecretId} is not enabled for rotation.`);
            }
            if (!data.VersionIdsToStages) {
                throw new Error(`Secret ${this.event.SecretId} has no version for rotation.`);
            }
            if (!data.VersionIdsToStages[this.event.ClientRequestToken]) {
                throw new Error(`Secret version ${this.event.ClientRequestToken} has no stage for rotation of secret ${this.event.SecretId}.`);
            }
            if (data.VersionIdsToStages[this.event.ClientRequestToken].includes(VersionStage.CURRENT)) {
                throw new Error(`Secret version ${this.event.ClientRequestToken} already set as ${VersionStage.CURRENT} for secret ${this.event.SecretId}.`);
            }
            if (!data.VersionIdsToStages[this.event.ClientRequestToken].includes(VersionStage.PENDING)) {
                throw new Error(`Secret version ${this.event.ClientRequestToken} not set as ${VersionStage.PENDING} for rotation of secret ${this.event.SecretId}.`);
            }
            /* eslint-enable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/strict-boolean-expressions */
        });
    }

    public async createSecret(secret: Secret): Promise<Result> {
        this.checkRotationStep(RotationStep.CREATE_SECRET);

        try {
            const data = await this.secretsManager.getSecretValue({
                /* eslint-disable @typescript-eslint/naming-convention */
                SecretId:  this.event.SecretId,
                VersionId: this.event.ClientRequestToken,
                /* eslint-enable @typescript-eslint/naming-convention */
            }).promise();
            return {
                message: `${RotationStep.CREATE_SECRET}: Successfully retrieved version ${this.event.ClientRequestToken}, created at ${data.CreatedDate?.toString() ?? 'unknown'}, of secret ${this.event.SecretId}.`,
                secret:  data,
            };
        } catch (err: unknown) {
            if ((err as AWSError).code !== 'ResourceNotFoundException') throw err;
            await this.secretsManager.putSecretValue({
                ...secret,
                /* eslint-disable @typescript-eslint/naming-convention */
                SecretId:           this.event.SecretId,
                ClientRequestToken: this.event.ClientRequestToken,
                VersionStages:      [
                    VersionStage.PENDING,
                ],
                /* eslint-enable @typescript-eslint/naming-convention */
            }).promise();
            return {
                message: `${RotationStep.CREATE_SECRET}: Successfully put the secret for ARN ${this.event.SecretId} with version ${this.event.ClientRequestToken}.`,
            };
        }
    }

    public async setSecret(): Promise<Result> {
        this.checkRotationStep(RotationStep.SET_SECRET);

        let data: SecretsManager.GetSecretValueResponse = {};
        do {
            try {
                /* eslint-disable no-await-in-loop */
                data = await this.secretsManager.getSecretValue({
                    /* eslint-disable @typescript-eslint/naming-convention */
                    SecretId:     this.event.SecretId,
                    VersionStage: VersionStage.PENDING,
                    /* eslint-enable */
                }).promise();
                /* eslint-enable no-await-in-loop */
            } catch (err: unknown) {
                if ((err as AWSError).code !== 'ResourceNotFoundException') throw err;
            }
        } while (!Object.keys(data).length);

        return {
            message: `${RotationStep.SET_SECRET}: Successfully retrieved version ${data.VersionId ?? 'unknown'} of secret ${this.event.SecretId} for setting the secret in the service.`,
            secret:  data,
        };
    }

    public async testSecret(): Promise<Result> {
        this.checkRotationStep(RotationStep.TEST_SECRET);

        let data: SecretsManager.GetSecretValueResponse = {};
        do {
            try {
                /* eslint-disable no-await-in-loop */
                data = await this.secretsManager.getSecretValue({
                    /* eslint-disable @typescript-eslint/naming-convention */
                    SecretId:     this.event.SecretId,
                    VersionStage: VersionStage.PENDING,
                    /* eslint-enable @typescript-eslint/naming-convention */
                }).promise();
                /* eslint-enable no-await-in-loop */
            } catch (err: unknown) {
                if ((err as AWSError).code !== 'ResourceNotFoundException') throw err;
            }
        } while (!Object.keys(data).length);

        return {
            message: `${RotationStep.TEST_SECRET}: Successfully retrieved version ${data.VersionId ?? 'unknown'} of secret ${this.event.SecretId} for testing the secret in the service.`,
            secret:  data,
        };
    }

    public async finishSecret(): Promise<Result> {
        this.checkRotationStep(RotationStep.FINISH_SECRET);

        const data = await this.secretsManager.getSecretValue({
            /* eslint-disable @typescript-eslint/naming-convention */
            SecretId:     this.event.SecretId,
            VersionStage: VersionStage.CURRENT,
            /* eslint-enable @typescript-eslint/naming-convention */
        }).promise();
        if (data.VersionId === this.event.ClientRequestToken) {
            return {
                message: `${RotationStep.FINISH_SECRET}: Version ${data.VersionId} already marked as ${VersionStage.CURRENT} for ${this.event.SecretId}.`,
            };
        }

        await this.secretsManager.updateSecretVersionStage({
            /* eslint-disable @typescript-eslint/naming-convention */
            SecretId:            this.event.SecretId,
            VersionStage:        VersionStage.CURRENT,
            MoveToVersionId:     this.event.ClientRequestToken,
            RemoveFromVersionId: data.VersionId,
            /* eslint-enable @typescript-eslint/naming-convention */
        }).promise();

        await this.secretsManager.updateSecretVersionStage({
            /* eslint-disable @typescript-eslint/naming-convention */
            SecretId:            this.event.SecretId,
            VersionStage:        VersionStage.PENDING,
            RemoveFromVersionId: this.event.ClientRequestToken,
            /* eslint-enable @typescript-eslint/naming-convention */
        }).promise();

        return {
            message: `${RotationStep.FINISH_SECRET}: Successfully set ${VersionStage.CURRENT} to version ${this.event.ClientRequestToken} for secret ${this.event.SecretId}. Successfully retrieved previous version ${data.VersionId ?? 'unknown'} of secret ${this.event.SecretId} for revocation.`,
            secret:  data,
        };
    }

    private checkRotationStep(expect: RotationStep): void {
        if (this.event.Step !== expect) throw new Error(`${this.event.Step}: Expect in step ${expect}.`);
    }
}
