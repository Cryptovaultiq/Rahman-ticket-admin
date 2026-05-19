export default async function handler(req, res) {
  // Enable CORS for cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const submission = req.body;
    
    // Validate submission data
    if (!submission.email || !submission.eventTitle) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get GitHub credentials from environment variables
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPO || 'Cryptovaultiq/Rahman-ticket-admin';
    const githubBranch = process.env.GITHUB_BRANCH || 'main';

    if (!githubToken) {
      return res.status(500).json({ error: 'GitHub not configured' });
    }

    // Fetch current submissions.json from GitHub
    const getResponse = await fetch(
      `https://api.github.com/repos/${githubRepo}/contents/submissions.json`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    let submissions = [];
    let sha = null;

    if (getResponse.ok) {
      const fileData = await getResponse.json();
      const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
      const jsonData = JSON.parse(content);
      submissions = jsonData.submissions || [];
      sha = fileData.sha;
    }

    // Add new submission with timestamp
    const newSubmission = {
      id: Date.now(),
      ...submission,
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString()
    };

    submissions.unshift(newSubmission);

    // Prepare new file content
    const fileContent = Buffer.from(JSON.stringify({ submissions }, null, 2)).toString('base64');

    // Upload to GitHub
    const putResponse = await fetch(
      `https://api.github.com/repos/${githubRepo}/contents/submissions.json`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          message: `Add submission from ${submission.email}`,
          content: fileContent,
          sha: sha,
          branch: githubBranch
        })
      }
    );

    if (!putResponse.ok) {
      console.error('GitHub upload failed:', await putResponse.text());
      return res.status(500).json({ error: 'Failed to save submission' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Submission saved',
      submission: newSubmission
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
