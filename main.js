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

        let article = result.data[0].raw_url;
        console.log(article);
    })
          .catch((err) => {
              console.error(err);
          });