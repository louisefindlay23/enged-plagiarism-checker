require("dotenv").config();

const { Octokit } = require("@octokit/core");
const { restEndpointMethods } = require("@octokit/plugin-rest-endpoint-methods");
const MyOctokit = Octokit.plugin(restEndpointMethods);

let octokit = new MyOctokit({ auth: process.env.GITHUB_PAT });

octokit.rest.users
    .getAuthenticated({})
        .then((result) => {
          console.info("Success. You are now authenticated with the GitHub API.");
        })
        .catch((err) => {
            console.error(err);
        });

        octokit.rest.pulls.listFiles({
            owner: "section-engineering-education",
            repo: "engineering-education",
            pull_number: 4593,
          }).then((result) => {

        result.data.forEach((file) => {
            if (file.filename.includes("index.md")) {
                // TODO: Handle excluded author index.md file
                console.info(file.raw_url);
            }
            // TODO: Add CopyLeaks API
        });
    })
          .catch((err) => {
              console.error(err);
          });