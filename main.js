require("dotenv").config();

const fs = require("fs");

const {
    Copyleaks,
    CopyleaksConfig,
    CopyleaksURLSubmissionModel,
    CopyleaksExportModel,
} = require("plagiarism-checker");
const copyleaks = new Copyleaks();
const WEBHOOK_URL = "http://enged-plagiarism-checker.louisefindlay.com/webhook";

// Express
const express = require("express");
const app = express();
const ejs = require("ejs");
const bodyParser = require("body-parser");
const port = "4005";

// Initialising Express
app.use(express.json({ limit: "25mb" }));
app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static("public"));
app.set("view engine", "ejs");
app.listen(port);

app.get("/", (req, res) => {
    res.render("pages/index");
});

app.post("/retrieve-pr", function (req, res) {
    const pr = req.body.pr;
    console.info("Your PR number is " + pr);
    // Obtaining article raw file URL from GitHub
    const { Octokit } = require("@octokit/core");
    const {
        restEndpointMethods,
    } = require("@octokit/plugin-rest-endpoint-methods");
    const MyOctokit = Octokit.plugin(restEndpointMethods);

    let octokit = new MyOctokit({ auth: process.env.GITHUB_PAT });

    octokit.rest.users
        .getAuthenticated({})
        .then((result) => {
            console.info(
                "Success. You are now authenticated with the GitHub API."
            );
        })
        .catch((err) => {
            console.error(err);
        });

    octokit.rest.pulls
        .listFiles({
            owner: "section-engineering-education",
            repo: "engineering-education",
            pull_number: pr,
        })
        .then((result) => {
            result.data.forEach((file) => {
                if (file.filename.includes("index.md") && !file.filename.includes("author")) {
                    const article_url = file.raw_url;
                    plagarismCheck(article_url).then((result) => console.log(result));
                }
        })
    })
});

const scanID = Date.now() + 2;
const exportID = Date.now() + 3;

app.post("/webhook/completed/:scanID", function (req, res) {
    console.info("Scan Complete Webhook Posted");
    console.info(req.body);
    copyleaks
        .loginAsync(process.env.COPYLEAKS_EMAIL, process.env.COPYLEAKS_APIKEY)
        .then((loginResult) => {
            logSuccess("loginAsync", loginResult);
            // Run export method
            const requestID = req.body.results.internet[0].id;
            const model = new CopyleaksExportModel(
            `${WEBHOOK_URL}/export/${exportID}/completion`,
        [
            // results
            {
                id: requestID,
                endpoint: `${WEBHOOK_URL}/export/${exportID}/results/${requestID}`,
                verb: "POST",
                headers: [
                    ["content-type", "application/json"],
                 ],
            },
        ],
        {
            // crawled version
            endpoint: `${WEBHOOK_URL}/export/${exportID}/crawled-version`,
            verb: "POST",
              headers: [
                ["content-type", "application/json"],
              ],
        },
        3, 
        null, 
            // PDF report
        {
            endpoint: `${WEBHOOK_URL}/export/${exportID}/pdf-report`,
            verb: "POST",
            headers: [
            ["content-type", "application/pdf"],
            ],
        },
    );

    copyleaks.exportAsync(loginResult, scanID, exportID, model).then(
        (res) => logSuccess("exportAsync", res),
        (err) => {
            logError("exportAsync", err);
        }
    ),
        (err) => logError("submitUrlAsync - businesses", err);
        });
});

// Export Webhook Endpoints
app.post("/webhook/export/:exportID/completion", function (req, res) {
    console.info("Hit export complete webhook");
    console.info(req.body);
});

// Report Webhook Endpoints

app.post("/webhook/export/:exportID/results/:requestID", function (req, res) {
    console.info("Hit Results complete webhook");
    //console.info(req.body);
});

app.post("/webhook/export/:exportID/pdf-report", function (req, res) {
    console.info("Hit PDF Report complete webhook");
    console.info(req.body);
});

app.post("/webhook/export/:exportID/crawled-version", function (req, res) {
    console.info("Hit Crawled Version complete webhook");
    //console.info(req.body);
});

// Report Webhook Endpoints

async function plagarismCheck(article_url) {
    // Obtain Access Token
    console.info("Get Access Token");
    copyleaks
        .loginAsync(process.env.COPYLEAKS_EMAIL, process.env.COPYLEAKS_APIKEY)
        .then((loginResult) => {
            logSuccess("loginAsync", loginResult);
            // TODO: Use res.".expires" to get expiration time and refresh access token
            // Submit URL to Copyleaks
            var submission = new CopyleaksURLSubmissionModel(article_url, {
                sandbox: true,
                webhooks: {
                    status: `${WEBHOOK_URL}/{STATUS}/${scanID}`,
                },
                pdf: {
                    create: true,
                },
            });
            copyleaks
                .submitUrlAsync("businesses", loginResult, scanID, submission)
                .then((res) =>
                        logSuccess("submitUrlAsync - businesses", res),
                    (err) => logError("submitUrlAsync - businesses", err)
            //logSuccess("submitUrlAsync - businesses", res);
            //console.info(res);
);
});
}

function logError(title, err) {
    console.error("----------ERROR----------");
    console.error(`${title}:`);
    console.error(err);
    console.error("-------------------------");
}

function logSuccess(title, result) {
    console.log("----------SUCCESS----------");
    console.log(`${title}`);
    if (result) {
        console.log(`result:`);
        console.log(result);
    }
    console.log("-------------------------");
}
