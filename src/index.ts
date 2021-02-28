import * as sdk from 'aws-sdk';

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
     * The separation into independently invoked steps enables the AWS Secrets Manager team to add additional functionality to occur between steps.
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
     * Secrets Manager uses this token to ensure the idempotency of requests during any required retries caused by failures of individual calls.
     * This value is a UUID-type value to ensure uniqueness within the specified secret.
     * This value becomes the SecretVersionId of the new version of the secret.
     */
    ClientRequestToken: string;
    /* eslint-enable @typescript-eslint/naming-convention */
}

export type Secret = { SecretBinary?: sdk.SecretsManager.SecretBinaryType; SecretString?: sdk.SecretsManager.SecretStringType } // eslint-disable-line @typescript-eslint/naming-convention
export type SecretProvider = () => Promise<Secret>
export type SecretConsumer = (secret: Secret) => Promise<void>

export class Rotation {
    private secretsManager: sdk.SecretsManager;

    constructor(private event: RotationEvent, options?: sdk.SecretsManager.Types.ClientConfiguration) {
        this.secretsManager = new sdk.SecretsManager(options);

        this.secretsManager.describeSecret({
            /* eslint-disable @typescript-eslint/naming-convention */
            SecretId: this.event.SecretId,
            /* eslint-enable @typescript-eslint/naming-convention */
        }, (err, data) => {
            if (err) throw err;
            if (!data.RotationEnabled) {
                console.log(`Secret ${this.event.SecretId} is not enabled for rotation.`);
                throw new Error(`Secret ${this.event.SecretId} is not enabled for rotation.`);
            }
            if (data.VersionIdsToStages === undefined) {
                console.log(`Secret ${this.event.SecretId} has no version for rotation.`);
                throw new Error(`Secret ${this.event.SecretId} has no version for rotation.`);
            }
            if (data.VersionIdsToStages[this.event.ClientRequestToken] === undefined) {
                console.log(`Secret version ${this.event.ClientRequestToken} has no stage for rotation of secret ${this.event.SecretId}.`);
                throw new Error(`Secret version ${this.event.ClientRequestToken} has no stage for rotation of secret ${this.event.SecretId}.`);
            }
            if (data.VersionIdsToStages[this.event.ClientRequestToken].includes(VersionStage.CURRENT)) {
                console.log(`Secret version ${this.event.ClientRequestToken} already set as ${VersionStage.CURRENT} for secret ${this.event.SecretId}.`);
                return;
            }
            if (!data.VersionIdsToStages[this.event.ClientRequestToken].includes(VersionStage.PENDING)) {
                console.log(`Secret version ${this.event.ClientRequestToken} not set as ${VersionStage.PENDING} for rotation of secret ${this.event.SecretId}.`);
                throw new Error(`Secret version ${this.event.ClientRequestToken} not set as ${VersionStage.PENDING} for rotation of secret ${this.event.SecretId}.`);
            }
        });
    }

    async createSecret(secretGenerate: SecretProvider): Promise<void> {
        this.checkRotationStep(RotationStep.CREATE_SECRET);

        try {
            const data = await this.secretsManager.getSecretValue({
                /* eslint-disable @typescript-eslint/naming-convention */
                SecretId: this.event.SecretId,
                VersionId: this.event.ClientRequestToken,
                /* eslint-enable @typescript-eslint/naming-convention */
            }).promise();
            console.log(`${RotationStep.CREATE_SECRET}: Successfully retrieved version ${this.event.ClientRequestToken}, created at ${data.CreatedDate}, of secret ${this.event.SecretId}.`);
        } catch (err) {
            if (err.code !== 'ResourceNotFoundException') throw err;
            await this.secretsManager.putSecretValue({
                ...await secretGenerate(),
                /* eslint-disable @typescript-eslint/naming-convention */
                SecretId: this.event.SecretId,
                ClientRequestToken: this.event.ClientRequestToken,
                VersionStages: [
                    VersionStage.PENDING,
                ],
                /* eslint-enable @typescript-eslint/naming-convention */
            }).promise();
            console.log(`${RotationStep.CREATE_SECRET}: Successfully put the secret for ARN ${this.event.SecretId} with version ${this.event.ClientRequestToken}.`);
        }
    }

    async setSecret(serviceSetup: SecretConsumer): Promise<void> {
        this.checkRotationStep(RotationStep.SET_SECRET);

        const data = await this.secretsManager.getSecretValue({
            /* eslint-disable @typescript-eslint/naming-convention */
            SecretId: this.event.SecretId,
            VersionStage: VersionStage.PENDING,
            /* eslint-enable @typescript-eslint/naming-convention */
        }).promise();
        await serviceSetup(data);

        console.log(`${RotationStep.SET_SECRET}: Successfully set the secret in the service.`);
    }

    async testSecret(serviceTest: SecretConsumer): Promise<void> {
        this.checkRotationStep(RotationStep.TEST_SECRET);

        const data = await this.secretsManager.getSecretValue({
            /* eslint-disable @typescript-eslint/naming-convention */
            SecretId: this.event.SecretId,
            VersionStage: VersionStage.PENDING,
            /* eslint-enable @typescript-eslint/naming-convention */
        }).promise();
        await serviceTest(data);

        console.log(`${RotationStep.TEST_SECRET}: Successfully test the secret in the service.`);
    }

    async finishSecret(): Promise<void> {
        this.checkRotationStep(RotationStep.FINISH_SECRET);

        const data = await this.secretsManager.getSecretValue({
            /* eslint-disable @typescript-eslint/naming-convention */
            SecretId: this.event.SecretId,
            VersionStage: VersionStage.CURRENT,
            /* eslint-enable @typescript-eslint/naming-convention */
        }).promise();
        if (data.VersionId === this.event.ClientRequestToken) {
            console.log(`${RotationStep.FINISH_SECRET}: Version ${data.VersionId} already marked as ${VersionStage.CURRENT} for ${this.event.SecretId}.`);
            return;
        }

        await this.secretsManager.updateSecretVersionStage({
            /* eslint-disable @typescript-eslint/naming-convention */
            SecretId: this.event.SecretId,
            VersionStage: VersionStage.CURRENT,
            MoveToVersionId: this.event.ClientRequestToken,
            RemoveFromVersionId: data.VersionId,
            /* eslint-enable @typescript-eslint/naming-convention */
        }).promise();

        await this.secretsManager.updateSecretVersionStage({
            /* eslint-disable @typescript-eslint/naming-convention */
            SecretId: this.event.SecretId,
            VersionStage: VersionStage.PENDING,
            RemoveFromVersionId: this.event.ClientRequestToken,
            /* eslint-enable @typescript-eslint/naming-convention */
        }).promise();

        console.log(`${RotationStep.FINISH_SECRET}: Successfully set ${VersionStage.CURRENT} to version ${this.event.ClientRequestToken} for secret ${this.event.SecretId}.`);
    }

    async revokePreviousSecret(revoke: SecretConsumer): Promise<void> {
        const data = await this.secretsManager.getSecretValue({
            /* eslint-disable @typescript-eslint/naming-convention */
            SecretId: this.event.SecretId,
            VersionStage: VersionStage.PREVIOUS,
            /* eslint-enable @typescript-eslint/naming-convention */
        }).promise();
        await revoke(data);

        console.log(`revokePreviousSecret: Successfully revoke previous version ${data.VersionId} for secret ${this.event.SecretId}.`);
    }

    private checkRotationStep(expect: RotationStep): void {
        if (this.event.Step !== expect) throw new Error(`${this.event.Step}: Expect in step ${expect}.`);
    }
}
