require("dotenv").config();

const axios = require("axios");
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

    let pr = null;

    if (req.body.payload) {
        let github_response = req.body.payload;
        let newArray = [];
        newArray.push(github_response);
        github_response = JSON.parse(newArray);
        pr = github_response.number;
    } else {
        pr = req.body.pr;
    }
    console.info(`Your PR Number is ${pr}`);
    getPR(pr);
});

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
                        .then((result) => console.log(result))
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
const exportID = Date.now() + 3;

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
                    fs.access(`public/reports/`, (error) => {
                        if (!error) {
                            console.info("Reports directory exists");
                            const report = fs.createWriteStream(
                                `public/reports/${req.params.scanID}.pdf`
                            );
                            console.info(report);
                            result.data.pipe(report);
                            report.on("finish", () => {
                                console.info(
                                    `Report generated: /reports/${req.params.scanID}.pdf`
                                );
                                res.redirect(
                                    `/reports/${req.params.scanID}.pdf`
                                );
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

                const postPR = 21;

                const comment = `Plagiarism Report downloaded. View at: http://enged-plagiarism-checker.louisefindlay.com/reports/${req.params.scanID}.pdf`;

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
    console.log("----------SUCCESS----------");
    console.log(`${title}`);
    if (result) {
        console.log(`result:`);
        console.log(result);
    }
    console.log("-------------------------");
}
