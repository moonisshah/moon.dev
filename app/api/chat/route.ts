import { HfInference } from '@huggingface/inference';
import { distance } from 'fastest-levenshtein';

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

export const runtime = 'edge';

function isSimilar(textA: string, textB: string, threshold = 0.8): boolean {
  const maxLength = Math.max(textA.length, textB.length);
  const levenshteinDistance = distance(textA, textB);
  const similarity = 1 - levenshteinDistance / maxLength;
  return similarity >= threshold;
}

function majorityVote(responses: string[]): string {
  const responseCounts: Record<string, number> = {};

  responses.forEach(response => {
    let foundSimilar = false;
    for (const existingResponse in responseCounts) {
      if (isSimilar(existingResponse, response)) {
        responseCounts[existingResponse]++;
        foundSimilar = true;
        break;
      }
    }

    if (!foundSimilar) {
      responseCounts[response] = 1;
    }
  });

  let bestResponse = '';
  let highestCount = 0;
  for (const response in responseCounts) {
    if (responseCounts[response] > highestCount) {
      bestResponse = response;
      highestCount = responseCounts[response];
    }
  }

  return bestResponse;
}

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const sendJSON = (data: any) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
        };

        sendJSON({ stage: 'thinking' });
        await new Promise(resolve => setTimeout(resolve, 1500));

        sendJSON({ stage: 'model1' });
        const response1 = await hf.textGeneration({
          model: 'microsoft/Phi-3.5-mini-instruct',
          inputs: prompt,
          parameters: { max_new_tokens: 200, temperature: 0.3 },
        });

        sendJSON({ stage: 'model2' });
        const response2 = await hf.textGeneration({
          model: 'mistralai/Mistral-7B-Instruct-v0.3',
          inputs: prompt,
          parameters: { max_new_tokens: 200, temperature: 0.4 },
        });

        sendJSON({ stage: 'model3' });
        const response3 = await hf.textGeneration({
          model: 'google/flan-t5-large',
          inputs: prompt,
          parameters: { max_new_tokens: 200, temperature: 0.5 },
        });

        sendJSON({ stage: 'ensembling' });
        // Add a delay to ensure the ensembling message is visible
        await new Promise(resolve => setTimeout(resolve, 1000));

        let finalAnswer = majorityVote([
          response1.generated_text,
          response2.generated_text,
          response3.generated_text,
        ]);

        if (finalAnswer.toLowerCase().startsWith(prompt.toLowerCase())) {
          finalAnswer = finalAnswer.slice(prompt.length).trim();
        }

        finalAnswer = finalAnswer.replace(/^Answer:\s*/i, '').trim();

        const sentencePattern = /---|#|(\.\s)/;
        const sentences = finalAnswer.split(sentencePattern).filter(Boolean);
        const uniqueSentences = Array.from(new Set(sentences.map(s => s.trim())));

        if (uniqueSentences.length > 1) {
          finalAnswer = uniqueSentences.slice(0, 20).join(' ').trim();
        } else {
          finalAnswer = uniqueSentences[0].trim();
        }

        sendJSON({ finalAnswer });
      } catch (error: unknown) {
        const errorMessage = (error as Error).message || 'Unknown error occurred';
        console.error('Error fetching model responses:', errorMessage);
        controller.enqueue(encoder.encode(JSON.stringify({ error: errorMessage }) + '\n'));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/json' },
  });
}