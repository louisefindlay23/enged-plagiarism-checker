require("dotenv").config();

const axios = require("axios");
const fs = require("fs");

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

app.get("/file/:scanID", (req, res) => {
    console.info(req.params.scanID);
	var options = {
    root: "./reports",
  };
const filename = req.params.scanID + ".pdf";
res.sendFile(filename, options, function (err) {
    if (err) {
      console.error(err);
      res.status(err.status).end();
    }
    else {
      console.log('Sent:', filename);
    }
});
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

// Retrieve and download scan PDF
app.post("/webhook/completed/:scanID", function (req, res) {
    //res.status(200).send();

    axios
        .get(
            "https://api.copyleaks.com/v3/downloads/" +
                req.params.scanID +
                "/report.pdf",
            {
                headers: {
                    Authorization:
                        "Bearer " + process.env.COPYLEAKS_ACCESSTOKEN,
                },
                responseType: "stream",
            }
        )
        .then(function (result) {
            result.data.pipe(
                fs.createWriteStream("./reports/" + req.params.scanID + ".pdf")
            );
            console.info("Report generated");
            //res.sendFile(req.params.scanID + ".pdf", { root: "./reports" });
            res.redirect("/file/" + req.params.scanID);
        })
        .catch(function (err) {
            console.error(err);
        });
});

function plagarismCheck(article_url) {
    if (!process.env.COPYLEAKS_ACCESSTOKEN) {
        // Obtain Access Token
        console.info("Get Access Token");
        axios
            .post("https://id.copyleaks.com/v3/account/login/api", {
                email: process.env.COPYLEAKS_EMAIL,
                key: process.env.COPYLEAKS_APIKEY,
            })
            .then(function (res) {
                //process.env.COPYLEAKS_ACCESSTOKEN = res.data.access_token;
                console.info;
            })
            .catch(function (err) {
                console.error(err.response);
            });
        // Scan URL
    } else {
        console.info("Have access token");
        const scanID = Math.floor(1000 + Math.random() * 9000);
        axios
            .put(
                "https://api.copyleaks.com/v3/businesses/submit/url/" + scanID,
                {
                    url: "https://github.com/section-engineering-education/engineering-education/raw/64c8d371e74285fe52bf783d69f20cee15ad803d/content/articles/complete-guide-on-using-sequelize-basic-and-advanced-features/index.md",
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
