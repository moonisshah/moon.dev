import { HfInference } from '@huggingface/inference';

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

export const runtime = 'edge';

// In-memory storage for user feedback (for demonstration purposes)
let modelScores: Record<string, number> = {
  'microsoft/Phi-3.5-mini-instruct': 1,
  'mistralai/Mistral-7B-Instruct-v0.3': 1,
  'google/flan-t5-large': 1,
};

export async function POST(req: Request) {
  const { prompt, feedback } = await req.json();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const sendJSON = (data: any) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
        };

        // Handle feedback if provided
        if (feedback && feedback.modelId && feedback.rating) {
          // Update model scores based on feedback
          if (modelScores[feedback.modelId] !== undefined) {
            modelScores[feedback.modelId] += feedback.rating; // rating: +1 for positive, -1 for negative
          } else {
            modelScores[feedback.modelId] = 1 + feedback.rating;
          }
          sendJSON({ message: 'Feedback received. Thank you!' });
          controller.close();
          return;
        }

        sendJSON({ stage: 'thinking' });
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Collect responses from multiple models
        const models = [
          {
            name: 'Model 1',
            stage: 'model1',
            modelId: 'microsoft/Phi-3.5-mini-instruct',
            parameters: { max_new_tokens: 400, temperature: 0.3 },
          },
          {
            name: 'Model 2',
            stage: 'model2',
            modelId: 'mistralai/Mistral-7B-Instruct-v0.3',
            parameters: { max_new_tokens: 400, temperature: 0.4 },
          },
          {
            name: 'Model 3',
            stage: 'model3',
            modelId: 'google/flan-t5-large',
            parameters: { max_new_tokens: 400, temperature: 0.5 },
          },
        ];

        const responses: { modelId: string; text: string }[] = [];

        for (const model of models) {
          sendJSON({ stage: model.stage });
          const response = await hf.textGeneration({
            model: model.modelId,
            inputs: prompt,
            parameters: model.parameters,
          });
          responses.push({ modelId: model.modelId, text: response.generated_text });
        }

        sendJSON({ stage: 'filtering' });

        // Filter responses based on relevance to the prompt
        const filteredResponses = [];
        for (const res of responses) {
          const similarity = await hf.sentenceSimilarity({
            model: 'sentence-transformers/all-MiniLM-L6-v2', // A lightweight model for sentence embeddings
            inputs: {
              source_sentence: prompt,
              sentences: [res.text],
            },
          });

          const score = similarity[0];
          if (score >= 0.5) {
            // Keep responses with similarity score >= 0.5
            filteredResponses.push({ ...res, score });
          }
        }

        if (filteredResponses.length === 0) {
          sendJSON({ finalAnswer: "I'm sorry, I couldn't generate a relevant response." });
          controller.close();
          return;
        }

        sendJSON({ stage: 'ensembling' });
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Weight responses based on user feedback (modelScores)
        const weightedResponses = filteredResponses.map((res) => {
          const weight = modelScores[res.modelId] || 1;
          return `${res.text} `.repeat(weight).trim();
        });

        // Combine the weighted responses
        const combinedText = weightedResponses.join('\n\n');

        // Use a summarization model to generate the final answer
        const summarizationModelId = 'facebook/bart-large-cnn';

        const summaryResponse = await hf.summarization({
          model: summarizationModelId,
          inputs: combinedText,
        });

        let finalAnswer = summaryResponse.summary_text.trim();

        sendJSON({ finalAnswer });

        // Provide model IDs for feedback
        sendJSON({
          models: filteredResponses.map((res) => ({ modelId: res.modelId })),
        });
      } catch (error: unknown) {
        const errorMessage = (error as Error).message || 'Unknown error occurred';
        console.error('Error fetching model responses:', errorMessage);
        controller.enqueue(encoder.encode(JSON.stringify({ error: errorMessage }) + '\n'));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/json' },
  });
}
