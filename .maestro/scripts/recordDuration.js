const stop = Date.now();
const duration = stop - Number(output.operationStart);
const durationSeconds = (duration / 1000).toFixed(1);
output.durationSeconds = durationSeconds;
