/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
export function sendToAnalytics(metric) {

    let attr = {};
    if (metric.attribution.serverTiming) {
        metric.attribution.serverTiming.map(sth => {
            // console.log("sth :%j", sth);
            //skip the stage Server Timing Header as it its present. The 'env' variable covers the environment.
            if (sth.name != "stage") {
                var name = sth.name.replaceAll("-", "").replaceAll("_", "");
                attr[`sth${name}`] = sth.description ? sth.description : sth.name;
                if (sth.duration) {
                    attr[`sth${name}duration`] = sth.duration;
                }
            }
        });
        delete (metric.attribution.serverTiming);
    }
    let payload = { ...metric.attribution, ...attr };
    // delete (payload.serverTiming);
    payload['delta'] = metric.delta;
    payload['value'] = metric.value;
    payload['rating'] = metric.rating;

    cwr('recordEvent', {
        type: 'cdn_metrics',
        data: payload,
    });
    console.log("Sent Metric :%j", payload);
}