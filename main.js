require("dotenv").config();

const fs = require("fs");
const { Copyleaks } = require("plagiarism-checker");
const copyleaks = new Copyleaks();

// Express
const express = require("express");
const app = express();
const ejs = require("ejs");
const bodyParser = require("body-parser");
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

function plagarismCheck(article_url) {
    if (process.env.COPYLEAKS_ACCESSTOKEN) {
        // Obtain Access Token
        console.info("Get Access Token");
        copyleaks
            .loginAsync(
                process.env.COPYLEAKS_EMAIL,
                process.env.COPYLEAKS_APIKEY
            )
            .then(
                (loginResult) => {
                    logSuccess("loginAsync", loginResult);
                },
                (err) => {
                    console.error(err.response);
                }
            );
        // Scan URL
    } else {
        console.info("Have access token");
        const scanID = Math.floor(1000 + Math.random() * 9000);
        axios
            .put(
                "https://api.copyleaks.com/v3/businesses/submit/url/" + scanID,
                {
                    url: article_url,
                    properties: {
                        sandbox: true,
                        webhooks: {
                            status:
                                "http://enged-plagiarism-checker.louisefindlay.com/webhook/{STATUS}/" +
                                scanID,
                        },
                        pdf: {
                            create: true,
                        },
                    },
                },
                {
                    headers: {
                        Authorization:
                            "Bearer " + process.env.COPYLEAKS_ACCESSTOKEN,
                    },
                }
            )
            .then(function (res) {})
            .catch(function (err) {
                console.error(err);
            });
    }
}
