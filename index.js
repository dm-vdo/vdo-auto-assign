const core = require('@actions/core');
const github = require('@actions/github');
const yaml = require("js-yaml");
const _ = require("lodash");

const context = github.context;

const parseConfig = function (content) {
  var r = yaml.parse(content);
  console.log(r);
  if(r == []) {
    throw "config is empty or unparseable"
  }
  return r;
};
    
const main = async () => {
  try {
    /**
     * We need to fetch all the inputs that were provided to our action
     * and store them in variables for us to use.
     **/
    const token = core.getInput('token', { required: true });      
    const config_path = core.getInput('config');  

    /**
     * Now we need to create an instance of Octokit which will use to call
     * GitHub's REST API endpoints.
     * We will pass the token as an argument to the constructor. This token
     * will be used to authenticate our requests.
     * You can find all the information about how to use Octokit here:
     * https://octokit.github.io/rest.js/v18
     **/
    const octokit = new github.getOctokit(token);

    // Now we parse the config file.
    const configContent = await fetchContent(octokit, configPath);
    const config = parseConfig(configContent);

    core.debug("config");
    core.debug(JSON.stringify(config));

    const { data: pullRequest } = await octokit.pulls.get({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: context.payload.pull_request.number,
      reviewers: [],
    });
      
    const author = pullRequest.user.login;
      
    var reviewers = new Set();
    _.each(_.keys(config), (globPattern) => {
      let newReviewers = _.pull(config[globPattern], author);
      for (const reviewer of newReviewers) {
        reviewers.add(reviewer);
      }
    });      

    core.debug("reviewers");
    core.debug(reviewers);
      
    core.info("finished!");
      
  } catch (error) {
    core.setFailed(error.message);
  }
}

// Call the main function to run the action
main();
