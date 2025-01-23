const OpenAI = require("openai");
const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configure OpenAI API
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// System message constant
const SYSTEM_MESSAGE = {
    role: "system",
    content: "You are a helpful assistant for African Bank, providing accurate and professional responses about African Bank's products, services, and policies. Keep responses concise and structured for chat interfaces."
};

// Function to get completion from OpenAI
async function requestOpenAi(messages) {
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        temperature: 0.7,
        max_tokens: 300
    });
    return response.choices[0].message.content;
}

// Express setup
const app = express();
app.use(express.json());

// Dialogflow-compatible webhook endpoint
app.post('/dialogflow-webhook', async (req, res) => {
    try {
        // Get Dialogflow request parameters
        const dialogflowRequest = req.body;
        const sessionId = dialogflowRequest.session;
        const queryText = dialogflowRequest.queryResult.queryText;
        const parameters = dialogflowRequest.queryResult.parameters;
        const contexts = dialogflowRequest.queryResult.outputContexts;

        // Build conversation history from contexts
        const messages = [SYSTEM_MESSAGE];
        
        // Add context history if available
        if (contexts && contexts.length > 0) {
            contexts.forEach(context => {
                if (context.parameters && context.parameters.lastAIResponse) {
                    messages.push({
                        role: "assistant",
                        content: context.parameters.lastAIResponse
                    });
                }
            });
        }

        // Add current user message
        messages.push({ role: "user", content: queryText });

        // Get AI response
        const aiResponse = await requestOpenAi(messages);

        // Prepare Dialogflow response format
        const dialogflowResponse = {
            fulfillmentMessages: aiResponse,
            payload: {
                google: {
                    expectUserResponse: true
                }
            },
            outputContexts: [
                {
                    name: `${sessionId}/contexts/session-vars`,
                    lifespanCount: 5,
                    parameters: {
                        lastAIResponse: aiResponse,
                        lastUserQuery: queryText
                    }
                }
            ]
        };

        res.json(dialogflowResponse);

    } catch (error) {
        console.error('Dialogflow Webhook Error:', error);
        res.status(200).json({ // Dialogflow expects 200 even for errors
            fulfillmentMessages: [{
                text: {
                    text: ["Sorry, we're experiencing technical difficulties. Please try again later."]
                }
            }]
        });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Dialogflow Webhook running on port ${PORT}`);
});
