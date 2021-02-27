import { SecretsManager } from 'aws-sdk';

export enum VersionStage {
    Current = 'AWSCURRENT',
    Pending = 'AWSPENDING',
    Previous = 'AWSPREVIOUS'
}

export enum RotationStep {
    CreateSecret = 'createSecret',
    SetSecret = 'setSecret',
    TestSecret = 'testSecret',
    FinishSecret = 'finishSecret',
}

export interface RotationEvent {
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
}

export type Secret = { SecretBinary?: SecretsManager.SecretBinaryType; SecretString?: SecretsManager.SecretStringType; }
export type SecretProvider = () => Promise<Secret>
export type SecretConsumer = (secret: Secret) => Promise<void>

export class Rotation {
    private secretsManager: SecretsManager;
    private event: RotationEvent;

    private checkRotationStep(expect: RotationStep): void {
        if (this.event.Step !== expect) throw new Error(`${this.event.Step}: Expect in step ${expect}.`);
    }

    constructor(event: RotationEvent, options?: SecretsManager.Types.ClientConfiguration) {
        this.event = event;

        this.secretsManager = new SecretsManager(options);

        this.secretsManager.describeSecret({
            SecretId: this.event.SecretId,
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
            if (data.VersionIdsToStages[this.event.ClientRequestToken].includes(VersionStage.Current)) {
                console.log(`Secret version ${this.event.ClientRequestToken} already set as ${VersionStage.Current} for secret ${this.event.SecretId}.`);
                return;
            }
            if (!data.VersionIdsToStages[this.event.ClientRequestToken].includes(VersionStage.Pending)) {
                console.log(`Secret version ${this.event.ClientRequestToken} not set as ${VersionStage.Pending} for rotation of secret ${this.event.SecretId}.`);
                throw new Error(`Secret version ${this.event.ClientRequestToken} not set as ${VersionStage.Pending} for rotation of secret ${this.event.SecretId}.`);
            }
        });
    }

    async createSecret(secretGenerate: SecretProvider): Promise<void> {
        this.checkRotationStep(RotationStep.CreateSecret);

        try {
            const data = await this.secretsManager.getSecretValue({
                SecretId: this.event.SecretId,
                VersionId: this.event.ClientRequestToken,
            }).promise();
            console.log(`${RotationStep.CreateSecret}: Successfully retrieved version ${this.event.ClientRequestToken}, created at ${data.CreatedDate}, of secret ${this.event.SecretId}.`);
        } catch (err) {
            if (err.code !== 'ResourceNotFoundException') throw err;
            await this.secretsManager.putSecretValue({
                ...await secretGenerate(),
                SecretId: this.event.SecretId,
                ClientRequestToken: this.event.ClientRequestToken,
                VersionStages: [
                    VersionStage.Pending,
                ],
            }).promise();
            console.log(`${RotationStep.CreateSecret}: Successfully put the secret for ARN ${this.event.SecretId} with version ${this.event.ClientRequestToken}.`);
        }
    }

    async setSecret(serviceSetup: SecretConsumer): Promise<void> {
        this.checkRotationStep(RotationStep.SetSecret);

        const data = await this.secretsManager.getSecretValue({
            SecretId: this.event.SecretId,
            VersionStage: VersionStage.Pending,
        }).promise();
        await serviceSetup(data);

        console.log(`${RotationStep.SetSecret}: Successfully set the secret in the service.`);
    }

    async testSecret(serviceTest: SecretConsumer): Promise<void> {
        this.checkRotationStep(RotationStep.TestSecret);

        const data = await this.secretsManager.getSecretValue({
            SecretId: this.event.SecretId,
            VersionStage: VersionStage.Pending,
        }).promise();
        await serviceTest(data);

        console.log(`${RotationStep.TestSecret}: Successfully test the secret in the service.`);
    }

    async finishSecret(): Promise<void> {
        this.checkRotationStep(RotationStep.FinishSecret);

        const data = await this.secretsManager.getSecretValue({
            SecretId: this.event.SecretId,
            VersionStage: VersionStage.Current,
        }).promise();
        if (data.VersionId === this.event.ClientRequestToken) {
            console.log(`${RotationStep.FinishSecret}: Version ${data.VersionId} already marked as ${VersionStage.Current} for ${this.event.SecretId}.`);
            return;
        }

        await this.secretsManager.updateSecretVersionStage({
            SecretId: this.event.SecretId,
            VersionStage: VersionStage.Current,
            MoveToVersionId: this.event.ClientRequestToken,
            RemoveFromVersionId: data.VersionId,
        }).promise();

        await this.secretsManager.updateSecretVersionStage({
            SecretId: this.event.SecretId,
            VersionStage: VersionStage.Pending,
            RemoveFromVersionId: this.event.ClientRequestToken,
        }).promise();

        console.log(`${RotationStep.FinishSecret}: Successfully set ${VersionStage.Current} to version ${this.event.ClientRequestToken} for secret ${this.event.SecretId}.`);
    }

    async revokePreviousSecret(revoke: SecretConsumer): Promise<void> {
        const data = await this.secretsManager.getSecretValue({
            SecretId: this.event.SecretId,
            VersionStage: VersionStage.Previous,
        }).promise();
        await revoke(data);

        console.log(`revokePreviousSecret: Successfully revoke previous version ${data.VersionId} for secret ${this.event.SecretId}.`);
    }
}
