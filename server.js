const OpenAI = require("openai");
const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configure OpenAI API
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// System message to define the assistant's behavior
const SYSTEM_MESSAGE = {
    role: "system",
    content: `
        You are an African Bank Virtual Assistant. Your role is to provide accurate, professional, and concise responses to client queries about African Bank's products, services, and policies. 
        You should maintain a helpful, empathetic, and professional tone. 
        Answer questions related to loans, savings, investments, credit cards, online banking, and other services offered by African Bank. If you're unsure about something, recommend clients contact customer service for clarification.
    `
};

// Function to get completion from OpenAI
async function requestOpenAi(messages) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Ensure this is the correct model
            messages: messages,
            temperature: 0.5, // Lower temperature for factual and professional responses
            max_tokens: 300 // Limit the response length
        });
        return response.choices[0].message.content;
    } catch (error) {
        console.error("OpenAI API Error:", error.message);
        return "I'm sorry, but I encountered an error while processing your request. Please try again.";
    }
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

        // Build conversation history
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
                if (context.parameters && context.parameters.lastUserQuery) {
                    messages.push({
                        role: "user",
                        content: context.parameters.lastUserQuery
                    });
                }
            });
        }

        // Add the current user message
        messages.push({ role: "user", content: queryText });

        // Debug: Log the conversation history sent to OpenAI
        console.log("Messages sent to OpenAI:", JSON.stringify(messages, null, 2));

        // Get AI response
        const aiResponse = await requestOpenAi(messages);

        // Prepare Dialogflow response format
        const dialogflowResponse = {
            fulfillmentMessages: [aiResponse],
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

        // Send the response back to Dialogflow
        res.json(dialogflowResponse);

    } catch (error) {
        console.error('Dialogflow Webhook Error:', error.message);
        res.status(200).json({
            fulfillmentMessages: "Sorry, we're experiencing technical difficulties. Please try again later."
        });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`African Bank Virtual Assistant is running on port ${PORT}`);
});
