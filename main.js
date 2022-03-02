require("dotenv").config();

const axios = require("axios");
const fs = require("fs");

const {
    Copyleaks,
    CopyleaksURLSubmissionModel,
} = require("plagiarism-checker");
const copyleaks = new Copyleaks();
// TODO: Change to SSL and change domain
const WEBHOOK_URL = "http://enged-plagiarism-checker.louisefindlay.com/webhook";

// Express
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const port = process.env.PORT;

// Initialising Express
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static("public"));
app.set("view engine", "ejs");
app.listen(port);

app.get("/", (req, res) => {
    res.render("pages/index");
});

app.post("/retrieve-pr", function (req, res) {
    // Triggered by form post or GitHub Repo Webhook
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

    let pr = null;
    // Get PR Number from Webhook or Form Body
    if (req.body.payload) {
        let github_response = req.body.payload;
        let newArray = [];
        newArray.push(github_response);
        github_response = JSON.parse(newArray);
        //console.info(github_response);
        pr = github_response.number;
        const prStatus = github_response.action;
        // Only continue if PR has been created
        /* if (prStatus === "opened") {
            console.info("PR has been created");
            //getPR(pr);
        } */
        // Only continue is plagarism check label is present
        let prLabels = github_response.pull_request.labels;
        prLabels.forEach((label) => {
            if (label.name === "needs plagiarism check") {
                console.info("Plagiarism Label found");
                //getPR(pr);
            }
        });
    } else {
        pr = req.body.pr;
        //getPR(pr);
    }
    console.info(`Your PR Number is ${pr}`);
});

// Obtaining article raw file URL from GitHub
function getPR(pr) {
    console.info("PR function run");
    const { Octokit } = require("@octokit/core");
    const {
        restEndpointMethods,
    } = require("@octokit/plugin-rest-endpoint-methods");
    const MyOctokit = Octokit.plugin(restEndpointMethods);

    let octokit = new MyOctokit({ auth: process.env.GITHUB_PAT });
    octokit.rest.pulls
        .listFiles({
            // TODO: Switch back to EngEd Repo
            owner: "louisefindlay23",
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
                    plagarismCheck(article_url)
                        .then((result) => console.info(result))
                        .catch((err) => {
                            console.error(err);
                        });
                }
            });
        })
        .catch((err) => {
            console.error(err);
        });
}

const scanID = Date.now() + 2;

app.post("/webhook/completed/:scanID", function (req, res) {
    console.info("Scan Complete Webhook Posted");
    copyleaks
        .loginAsync(process.env.COPYLEAKS_EMAIL, process.env.COPYLEAKS_APIKEY)
        .then((loginResult) => {
            logSuccess("loginAsync", loginResult);
            // Run download method
            const retrieveScan = async () => {
                try {
                    const result = await axios.get(
                        "https://api.copyleaks.com/v3/downloads/" +
                            req.params.scanID +
                            "/report.pdf",
                        {
                            headers: {
                                Authorization:
                                    "Bearer " + loginResult.access_token,
                            },
                            responseType: "stream",
                        }
                    );
                    // Access Reports Directory
                    fs.access(`public/reports/`, (error) => {
                        if (!error) {
                            console.info("Reports directory exists");
                            // Write and pipe PDF to file
                            const report = fs.createWriteStream(
                                `public/reports/${req.params.scanID}.pdf`
                            );
                            result.data.pipe(report);
                            report.on("finish", () => {
                                console.info(
                                    `Report generated: /reports/${req.params.scanID}.pdf`
                                );
                                // Download Finished
                                // TODO: Fix repetition (i.e. multiple comments posted) by ending post request
                            });
                            report.on("error", (err) => console.error(err));
                        } else {
                            console.error("Reports directory does not exist");
                        }
                    });
                } catch (err) {
                    console.error(err);
                }
            };
            retrieveScan().then(function () {
                console.info("Success");
                // GitHub Post Comment
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

                // TODO: Retrive PR number from earlier to post comment to same PR
                const postPR = 21;
                const comment = `Plagiarism Report downloaded. View at: http://enged-plagiarism-checker.louisefindlay.com/reports/${req.params.scanID}.pdf`;
                // TODO: Change back to EngEd repo
                octokit.rest.issues
                    .createComment({
                        owner: "louisefindlay23",
                        repo: "engineering-education",
                        issue_number: postPR,
                        body: comment,
                    })
                    .then((result) => {
                        console.info(
                            `Posted comment: ${comment} on PR ${postPR}`
                        );
                        console.info(result);
                        res.end();
                    })
                    .catch((err) => {
                        console.error(err);
                    });
            });
        })
        .catch((err) => {
            console.error(err);
        });
});

async function plagarismCheck(article_url) {
    // Obtain Access Token
    console.info("Logging into CopyLeaks API");
    copyleaks
        .loginAsync(process.env.COPYLEAKS_EMAIL, process.env.COPYLEAKS_APIKEY)
        .then((loginResult) => {
            logSuccess("loginAsync", loginResult);
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
            // Running plagiarism check
            copyleaks
                .submitUrlAsync("businesses", loginResult, scanID, submission)
                .then(
                    (res) => logSuccess("submitUrlAsync - businesses", res),
                    (err) => logError("submitUrlAsync - businesses", err)
                    //logSuccess("submitUrlAsync - businesses", res);
                    //console.info(res);
                );
        })
        .catch((err) => {
            console.error(err);
        });
}

function logError(title, err) {
    console.error("----------ERROR----------");
    console.error(`${title}:`);
    console.error(err);
    console.error("-------------------------");
}

function logSuccess(title, result) {
    console.info("----------SUCCESS----------");
    console.info(`${title}`);
    if (result) {
        console.info(`result:`);
        console.info(result);
    }
    console.info("-------------------------");
}
