const core = require('@actions/core');
const github = require('@actions/github');
const yaml = require("yaml");
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

async function fetchContent(client) {
	const response = await client.rest.repos.getContent({
		owner: "dm-vdo",
		repo: "vdo-auto-assign",
		path: ".github/auto_assign.yml"
	});

	return Buffer.from(response.data.content, response.data.encoding).toString();
};

async function assignReviewer(octokit, reviewer) {
	let key = "reviewers";
	let target = reviewer;

	if (_.isObject(reviewer) && _.has(reviewer, "team")) {
		key = "team_reviewers";
		target = reviewer.team;
	}

	await octokit.rest.pulls.requestReviewers({
		owner: context.repo.owner,
		repo: context.repo.repo,
		pull_number: context.payload.pull_request.number,
		[key]: [target],
	});
}

async function assignAssignee(octokit, assignee) {
	let key = "assignees";
	let target = assignee;

	if (_.isObject(assignee) && _.has(assignee, "team")) {
			return;
	}

	await octokit.rest.issues.addAssignees({
		owner: context.repo.owner,
		repo: context.repo.repo,
		issue_number: context.payload.pull_request.number,
		[key]: [target],
	});
}
		
const main = async () => {
	try {
		/**
		 * We need to fetch all the inputs that were provided to our action
		 * and store them in variables for us to use.
		 **/
		const token = core.getInput('token', { required: true });		 

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
		const configContent = await fetchContent(octokit);
		const config = parseConfig(configContent);

		core.debug("config");
		core.debug(JSON.stringify(config));

		const { data: pullRequest } = await octokit.rest.pulls.get({
			owner: context.repo.owner,
			repo: context.repo.repo,
			pull_number: context.payload.pull_request.number,
		});
			
		const author = pullRequest.user.login;

		// Set a reviewer if there isn't one already.
		if ((!pullRequest.requested_reviewers.length) && (!pullRequest.requested_teams.length)) {
			// Authors cannot be reviewers
			let reviewer = config["czar"];
			if (config["czar"] == author) {
				reviewer = config["backup"];
			}
			
			assignReviewer(octokit, reviewer).catch((error) => {
					core.setFailed(error.message);
			});
		}

		// Set an assignee if there isn't one already.
		if ((!pullRequest.assignees.length)) {			
			assignAssignee(octokit, author).catch((error) => {
				core.setFailed(error.message);
			});
		}
			
		core.info("finished!");
			
	} catch (error) {
		core.setFailed(error.message);
	}
}

// Call the main function to run the action
main();

		
