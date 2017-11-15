const AWS = require('aws-sdk')
const child_process = require('child_process')
const extend = require('extend')

const METRIC_ERROR = {
    time_total: 99
}

const cw = new AWS.CloudWatch()

AWS.config.update({region: 'us-west-2'})

function doCurl(url) {
    let cmd = [
        'curl -sm8 -w "{',
        '\\"time_namelookup\\":%{time_namelookup},',
        '\\"time_connect\\":%{time_connect},',
        '\\"time_appconnect\\":%{time_appconnect},',
        '\\"time_pretransfer\\":%{time_pretransfer},',
        '\\"time_starttransfer\\":%{time_starttransfer},',
        '\\"time_total\\":%{time_total},',
        '\\"http_code\\":\\"%{http_code}\\",',
        '\\"size_download\\":%{size_download}',
        '}" -o /dev/null ',
        url
    ].join('')

    return new Promise((resolve, reject) => {
        child_process.exec(cmd, (error, stdout, stderr) =>
            error ? reject(error) : resolve(JSON.parse(stdout))
         )
    })
}

function putTotalTime(prefix, metrics) {
    return new Promise((resolve, reject) => {
        cw.putMetricData({
            Namespace: 'webmon',
            MetricData: [{
                MetricName: `${prefix}-totalTime`,
                Dimensions: [
                    {Name: "Project", Value: "webmon"},
                    {Name: "Metric", Value: "TotalTime"},
                    {Name: "Prefix", Value: prefix},
                ],
                Unit: 'Seconds',
                Value: metrics.time_total,
            }],
        }, (err, data) => err ? reject(err) : resolve(data))
    })
}

function genPutMetrics(prefix) {
    return (metrics) => Promise.all([
        putTotalTime(prefix, metrics),
    ]).then(() => metrics)
}

function patchMetrics(metric) {
    return metric.http_code == '200'
        ? metric
        : METRIC_ERROR
}

function transformError(err) {
    console.error(err)
    return METRIC_ERROR
}

function check(prefix, url, options) {
    options = options || {}

    return doCurl(url)
        .then(patchMetrics)
        .catch(transformError)
        .then(genPutMetrics(prefix))
        .then(data => extend(data, {prefix, url}))
}

module.exports = {
    check: check
}
