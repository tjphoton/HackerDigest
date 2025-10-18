# Customized HackerNews Digest Workflow
This project implements a customized news digest generator inspired by HackerNews. The workflow is designed to automatically fetch articles daily and compile a structured email digest summarizing the latest in tech.

## Workflow Steps
1. **Fetch HackerNews RSS Feed**: A daily task scheduled at 9 AM to fetch articles from the HackerNews feed.
   - URL: [HackerNews RSS](https://news.ycombinator.com/news)
2. **Fetch Article Content**: For each article link, a markdown copy of the article is obtained using the Jina Reader API.
   - Example CURL command:
     ```bash
     curl "https://r.jina.ai/https://www.example.com" -H "Authorization: Bearer JINA_API_KEY"
     ```
3. **Generate Digest**: Compile the information using the OpenAI API (GPT-5) to create a well-structured email digest. The digest will consist of the following sections:
   - **Top Stories**: 1-2 paragraphs summarizing the most significant articles.
   - **Learn**: 1-2 paragraphs diving into educational content relevant to the tech community.
   - **Dig Deeper**: A bulleted list of additional interesting items with proper citations and clickable links.
4. **Email Formatting**: Convert the generated digest to a well-formatted HTML email with a maximum width of 600px.
5. **Send Email**: The formatted email is sent using Resend to the specified personal email address (`youremail@domain.com`), ensuring all links are properly formatted as clickable.

## Requirements
- Node.js
- TypeScript
- OpenAI API Key (`OPENAI_API_KEY`)
- Jina API Key (`JINA_API_KEY`)
- Dependencies as defined in your project (check your current setup)

## Important Notes
- Ensure that all necessary environment variables and API keys are set correctly before executing the workflow.
- Review the email sending configuration to comply with the email service being used.

## License
This project is licensed under the MIT License.