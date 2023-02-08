import {
    accountAPI,
    trustchainsAPI,
    demoAPI,
    profileAPI,
    schemaAPI,
    tokenAPI,
    externalAPI,
    ipfsAPI,
    analyticsAPI
} from '@api/service';
import { Guardians } from '@helpers/guardians';
import express from 'express';
import { createServer } from 'http';
import { authorizationHelper } from '@auth/authorization-helper';
import { IPFS } from '@helpers/ipfs';
import { policyAPI } from '@api/service/policy';
import { PolicyEngine } from '@helpers/policy-engine';
import { WebSocketsService } from '@api/service/websockets';
import { Users } from '@helpers/users';
import { settingsAPI } from '@api/service/settings';
import { loggerAPI } from '@api/service/logger';
import { MessageBrokerChannel, Logger } from '@guardian/common';
import { taskAPI } from '@api/service/task';
import { TaskManager } from '@helpers/task-manager';
import { singleSchemaRoute } from '@api/service/schema';
import { artifactAPI } from '@api/service/artifact';
import fileupload from 'express-fileupload';
import { contractAPI } from '@api/service/contract';

const PORT = process.env.PORT || 3002;
const RAW_REQUEST_LIMIT = process.env.RAW_REQUEST_LIMIT || '1gb';

Promise.all([
    MessageBrokerChannel.connect('API_GATEWAY'),
]).then(async ([cn]) => {
    try {
        const app = express();
        app.use(express.json());
        app.use(express.raw({
            inflate: true,
            limit: RAW_REQUEST_LIMIT,
            type: 'binary/octet-stream'
        }));
        app.use(fileupload());
        const channel = new MessageBrokerChannel(cn, 'guardian');
        const apiGatewayChannel = new MessageBrokerChannel(cn, 'api-gateway');
        new Logger().setChannel(channel);
        new Guardians().setChannel(channel);
        new IPFS().setChannel(channel);
        new PolicyEngine().setChannel(channel);
        new Users().setChannel(channel);

        const server = createServer(app);
        const wsService = new WebSocketsService(server, apiGatewayChannel);
        wsService.init();

        new TaskManager().setDependecies(wsService, apiGatewayChannel);

        ////////////////////////////////////////

        // Config routes
        app.use('/policies', authorizationHelper, policyAPI);
        app.use('/accounts/', accountAPI);
        app.use('/profiles/', authorizationHelper, profileAPI);
        app.use('/settings/', authorizationHelper, settingsAPI);
        app.use('/schema', authorizationHelper, singleSchemaRoute);
        app.use('/schemas', authorizationHelper, schemaAPI);
        app.use('/tokens', authorizationHelper, tokenAPI);
        app.use('/artifact', authorizationHelper, artifactAPI);
        app.use('/trustchains/', authorizationHelper, trustchainsAPI);
        app.use('/external/', externalAPI);
        app.use('/demo/', demoAPI);
        app.use('/ipfs', authorizationHelper, ipfsAPI);
        app.use('/logs', authorizationHelper, loggerAPI);
        app.use('/tasks/', taskAPI);
        app.use('/analytics/', authorizationHelper, analyticsAPI);
        app.use('/contracts', authorizationHelper, contractAPI);
        /////////////////////////////////////////

        server.listen(PORT, () => {
            new Logger().info(`Started on ${PORT}`, ['API_GATEWAY']);
        });
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}, (reason) => {
    console.log(reason);
    process.exit(0);
});
