import * as AwsSdkMock from 'aws-sdk-mock';
import { SecretsManager } from 'aws-sdk';

import { Rotation, RotationStep, VersionStage } from '../src';

describe('Initial secret rotation', () => {
    // GIVEN
    const event = {
        Step: RotationStep.CreateSecret,
        SecretId: 'aws-secrets-manager-arn',
        ClientRequestToken: 'version-id-new',
    };
    // THEN
    it('should pass', () => {
        AwsSdkMock.mock('SecretsManager', 'describeSecret', (params: SecretsManager.Types.DescribeSecretRequest, callback: any) => {
            console.log('SecretsManager: describeSecret: mocked');
            callback(undefined, {
                RotationEnabled: true,
                VersionIdsToStages: {
                    'version-id-old': [
                        VersionStage.Current,
                    ],
                    'version-id-new': [
                        VersionStage.Pending,
                    ],
                },
            });
        });
        expect(new Rotation(event)).toBeDefined();
        AwsSdkMock.restore('SecretsManager');
    });
});
