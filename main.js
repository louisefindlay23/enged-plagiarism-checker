require("dotenv").config();

const fs = require("fs");

const {
    Copyleaks,
    CopyleaksConfig,
    CopyleaksURLSubmissionModel,
    CopyleaksFileSubmissionModel,
    CopyleaksFileOcrSubmissionModel,
    CopyleaksDeleteRequestModel,
    CopyleaksExportModel,
} = require("plagiarism-checker");
const copyleaks = new Copyleaks();
const WEBHOOK_URL = "http://enged-plagiarism-checker.louisefindlay.com/webhook";

// Express
const express = require("express");
const app = express();
const ejs = require("ejs");
const bodyParser = require("body-parser");
const { nextTick } = require("process");
const port = "4005";

// Initialising Express
app.use(bodyParser.json());
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
                if (
                    file.filename.includes("index.md") &&
                    !file.filename.includes("author")
                ) {
                    const article_url = file.raw_url;
                    plagarismCheck(article_url);
                }
            });
        })
        .catch((err) => {
            console.error(err);
        });
});

const scanID = Date.now() + 2;

app.post(WEBHOOK_URL + "/submit/completed/:scanID", function (req, res) {
    console.info("Webhook posted");
    console.info(req.body);
    next();
});

function plagarismCheck(article_url) {
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
                    status: `${WEBHOOK_URL}/submit/{STATUS}`,
                },
            });
            copyleaks
                .submitUrlAsync("businesses", loginResult, scanID, submission)
                .then(
                    (res) => logSuccess("submitUrlAsync - businesses", res),
                    (err) => logError("submitUrlAsync - businesses", err)
                );
            //{
            //logSuccess("submitUrlAsync - businesses", result);
            //console.info(result);
            //exportReport(loginResult, scanID).then(function () {
            //console.info("Success");
            //});
        });
}

function exportReport(loginResult, scanID) {
    const resultID = Math.floor(1000 + Math.random() * 9000);

    const model = new CopyleaksExportModel(
        `${WEBHOOK_URL}/export/scanId/${scanID}/completion`,
        [
            // results
            {
                id: resultID,
                endpoint: `${WEBHOOK_URL}/export/${scanID}/result/${resultID}`,
                verb: "POST",
                //headers: [
                //    ["key", "value"],
                //    ["key2", "value2"],
                // ],
            },
        ],
        {
            // crawled version
            endpoint: `${WEBHOOK_URL}/export/${scanID}/crawled-version`,
            verb: "POST",
            //  headers: [
            //      ["key", "value"],
            //      ["key2", "value2"],
            //  ],
        }
    );

    copyleaks.exportAsync(loginResult, scanID, scanID, model).then(
        (res) => logSuccess("exportAsync", res),
        (err) => {
            logError("exportAsync", err);
        }
    ),
        (err) => logError("submitUrlAsync - businesses", err);
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
