import { GoogleGenAI } from "@google/genai";
import { PlannedSector, TrackStats } from '../types';
import { formatDuration } from '../utils/geoUtils';
import { formatPace } from '../utils/unitUtils';

export const analyzeRouteWithGemini = async (stats: TrackStats, sectors: PlannedSector[], targetTimeSeconds: number): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Simplify sector data to reduce token count but include new pace data
    const simplifiedSectors = sectors.map(s => ({
      id: s.id,
      km: `${(s.startDist/1000).toFixed(1)}-${(s.endDist/1000).toFixed(1)}`,
      grad: s.avgGradient.toFixed(1) + "%",
      targetPace: formatPace(s.targetPaceSeconds, 'metric')
    }));

    const prompt = `
      You are an elite race strategist. 
      Goal: Complete this ${(stats.totalDistance / 1000).toFixed(2)} km course in ${formatDuration(targetTimeSeconds)}.
      
      Route Stats:
      - Total Gain: ${Math.round(stats.totalElevationGain)} m
      - Avg Gradient: ${(stats.totalElevationGain / stats.totalDistance * 100).toFixed(1)}%
      
      Calculated Plan (500m splits based on Gap logic):
      ${JSON.stringify(simplifiedSectors, null, 2)}

      Provide a RUTHLESSLY CONCISE analysis. 
      Format: Markdown.
      Rules:
      - NO introductory fluff ("Here is your plan"). Start immediately with the first header.
      - Use emoji bullets.
      - Max 3 bullet points per section.
      - Keep sentences short and punchy.

      Sections:
      ### 🎯 Feasibility & Vibe
      (Is this goal realistic? What kind of runner thrives here?)

      ### ⚡️ Attack Zones
      (Specific sectors to push hard)

      ### 🛡️ Defense Zones
      (Where to conserve energy to avoid blowing up)

      ### 🧠 Mental Strategy
      (One mantra or focus tip for this specific terrain profile)
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "No analysis could be generated.";
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return "Unable to generate AI analysis at this time. Please ensure your API key is valid.";
  }
};