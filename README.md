# CloudFront Real User Monitoring

## Use cases:

1. monitor metrics like Cache Hit Ratio, Time to First Byte, Time to Last Byte, Page Load time, TCP/TLS connect time

1. compare performance metrics between CDNs, between origin vs CloudFront.

1. look at deeper metrics by content types (images, CSS, JS etc) for a particular CF distribution..

## AWS Services used:

CloudFront, CloudWatch RUM, CloudWatch Logs, Amazon Grafana, AWS Identity Center (AWS SSO)

## Architecture 

![CloudFront Performance](/images/cf-rum.png)


## Steps to build

1. Clone the repository into AWS Region where CloudWatch RUM is available.

1. Change into the directory and run below commands
    - `cd amazon-cloudfront-performance-monitoring/cdk`

1. Edit `deploy.sh` to update the deployment variables
```
# the AWS CLI profile name to be used.
export AWS_PROFILE=''
# name of domain to add RUM
export MONITOR_DOMAIN_NAME=''
# AWS Region to deploy the solution
export CDK_DEPLOY_REGION=''
# CW RUM sample rate, range between 0 and 1. setting a lower value reduces the
# events emitted by viewer sessions and cut cost.
export SAMPLE_RATE=0.1
```

4. Run `deploy.sh`

## Post deployment steps

## CloudFront 

1. Navigate to CloudFront console and open the distribution config from the list to modify.

1. Navigate to Behaviors tab and edit
![CloudFront Behavior](/images/cf-distribution1.jpg)

1. Assign the Response Header Policy to the one created during deployment (pattern {StackName}-default-prod) This policy enables ‘Server-Timing’ and ‘Timing-Allow-Origin’ headers for this behavior and *Save Changes*

![CloudFront Behavior Update](/images/cf-distribution2.jpg)

1. Repeat step2 for other cache behaviors.

1. Add a new ‘Origin’ pointing to the newly created bucket and map the pattern for /measure/* to be served from this origin. Alternately, copy  'measure/web-vitals.attribution.js' file to your current scripts folder and serve it from there through CloudFront.

## CloudWatch RUM

1. *Navigate* to CloudWatch RUM console in the AWS region deployed.

2. *Open* the RUM config created visible in the list view

![CloudWatch RUM](/images/cw-rum1.jpg)

3. *Edit* the config

![CloudWatch RUM](/images/cw-rum2.jpg)

4. Select *includeSubdomains* - needed it we are serving images, css, js from another subdomain from the one configured in variables during deployment.

![CloudWatch RUM](/images/cw-rum3.jpg)

5. *Save* the config.

6. Navigate to ‘Configuration→ General configuration’ and take a note of the CloudWatch Log group name. We will need this during the Grafana dashboard setup phase.

![CloudWatch RUM](/images/cw-rum5.jpg)

7. Navigate to ‘Configuration→ Javascript snippet’ and select ‘HTML’ from the Sample code panel. Copy the code snippet into a text file, we will need this during integration into application pages.

![CloudWatch RUM](/images/cw-rum6.jpg)

## Client side Instrumentation

In the head section of HTML page, place the above code snippet and the web-vitals.attribution.js file (located in the S3 bucket created)
![CloudWatch RUM](/images/client3.jpg)

A sample HTML page can be found  
[here, line 22 - 46](/sample.html)

## IAM Identity Center ( AWS SSO)

1. From AWS console, navigate to IAM Identity Center → Users
![AWS Organization](/images/org1.jpg)

1. Create a new user and verify the email.

## Grafana Dashboard

1. From AWS console, navigate to Amazon Grafana

2. Open the grafana workspace created.

![Grafana](/images/grafana1.jpg)

3. Assign the user created as 'Admin' user.

4. Navigate to *Grafana workspace URL*
![Grafana](/images/grafana2.jpg)

5. Login with user credentials.
![Grafana](/images/grafana3.jpg)

6. Once logged in, from left hand menu, move to *Gear Icon* → Data Sources.
![Grafana](/images/grafana4.jpg)

7. On the configuration page click *‘Add data source’*
![Grafana](/images/grafana5.jpg)

8. On the ‘Add data source’ page search for ‘cloudwatch’ and select it.
![Grafana](/images/grafana6.jpg)

9. In the CloudWatch data source configuration page. select the ‘Default Region’ where you deployed your application. Click ‘Save & test’ once done.
![Grafana](/images/grafana7.jpg)

10. Download ‘assets/basic.json’ file from the repository. Edit in your favorite editor and replace at line 3736 the Cloudwatch log group name we noted in the CloudWatch RUM section. Save the file.

11. From Grafana's left hand menu, move to ‘+’ → Import 
![Grafana](/images/grafana8.jpg)

12. *Import* the modified basic.json file
![Grafana](/images/grafana9.jpg)

13. Select ‘CloudWatch’ as data source.
![Grafana](/images/grafana10.jpg)

and click *‘Import’*

14. Update the 'log_group' variable to point to your CloudWatch Log Group for RUM.
- Go to 'Dashboard settings'
![Grafana](/images/grafana11.jpg)
- Go to Variables section
![Grafana](/images/grafana12.jpg)
- Edit the 'log_group' variable and point it to log group name (from above section CloudWatch RUM step 6)
![Grafana](/images/grafana13.jpg)
- Click 'Update' and 'Save dashboard' to save the changes.
![Grafana](/images/grafana14.jpg)

15. Access the website a few times so it can start capturing client side events.

Note: The dashboard allows you to filter the view by countries. Today, within Grafana there is no support to query CloudWatch logs groups and populate dashboard variables.As a work around, a StepFunction workflow is scheduled to run every 1 hr to fetch the most recent list of countries from the CloudWatch Logs. 
You can find the scheduler created in EventBridge and study the flow from their. The list of countries are populated into CloudWatch metric namespace 'Custom/RUM{StackName}'. Modify the Step Function accordingly to change this behavior or you can hardcode the country list in the dashboard.
You will need to modify the 'country' variable in the Grafana Dashboard to query your CloudWatch custom metric at line number 3641 in basic.json.
Ex: Replace
```dimension_values(us-east-1,Custom/RUM-CloudFrontMonitoringStack,CountryCodes,country)```
with your value.

16. Check to see the dashboard panels show up. Note, data may not be present initially.

## Additional Learning Resources:

*Resource Timing API -*
https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/Using_the_Performance_API 

*Server Timing Headers -* 
https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server-Timing

*Timing Allow Origin -* 
https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Timing-Allow-Origin
