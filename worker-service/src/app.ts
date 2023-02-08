import { ApplicationState, Logger, MessageBrokerChannel } from '@guardian/common';
import { Worker } from './api/worker';
import { HederaSDKHelper } from './api/helpers/hedera-sdk-helper';
import { ApplicationStates } from '@guardian/interfaces';

Promise.all([
    MessageBrokerChannel.connect('WORKERS_SERVICE')
]).then(async values => {
    const channelName = (process.env.SERVICE_CHANNEL || `worker.${Date.now()}`).toUpperCase()
    const [cn] = values;
    const channel = new MessageBrokerChannel(cn, 'worker');

    const logger = new Logger();
    logger.setChannel(channel);
    const state = new ApplicationState(channelName);
    state.setChannel(channel);
    await state.updateState(ApplicationStates.STARTED);

    HederaSDKHelper.setTransactionLogSender(async (data) => {
        await channel.request(`guardians.transaction-log-event`, data);
    });

    await state.updateState(ApplicationStates.INITIALIZING);
    const w = new Worker(channel, channelName);
    w.init();

    await state.updateState(ApplicationStates.READY);
    logger.info('Worker started', [channelName]);
}, (reason) => {
    console.log(reason);
    process.exit(0);
})
