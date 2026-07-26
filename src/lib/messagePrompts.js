/** Role-specific quick questions for messenger threads (not AI — user sends manually). */

export const ARTIST_MESSAGE_PROMPTS = [
  { id: 'deadline', label: 'Deadline', text: "What's the project deadline?" },
  { id: 'budget', label: 'Budget', text: "What's the budget or fee range for this work?" },
  { id: 'deliverables', label: 'Deliverables', text: 'What deliverables are you expecting?' },
  { id: 'timeline', label: 'Timeline', text: "What's the expected timeline from kickoff to final delivery?" },
  { id: 'references', label: 'References', text: 'Are there reference materials or brand guidelines I should review?' },
  { id: 'scope', label: 'Scope', text: 'Can you share more about the scope before I accept?' },
]

export const CLIENT_MESSAGE_PROMPTS = [
  { id: 'availability', label: 'Availability', text: "What's your availability for this project?" },
  { id: 'rate', label: 'Rate', text: "What's your rate for this type of work?" },
  { id: 'process', label: 'Process', text: 'Can you walk me through your process and typical turnaround?' },
  { id: 'examples', label: 'Examples', text: 'Do you have examples similar to what we are discussing?' },
  { id: 'kickoff', label: 'Getting started', text: 'What would you need from me to get started?' },
  { id: 'deliverables', label: 'Deliverables', text: 'Can you confirm the deliverables included in your quote?' },
]

export function getMessagePrompts(viewerIsArtist) {
  return viewerIsArtist ? ARTIST_MESSAGE_PROMPTS : CLIENT_MESSAGE_PROMPTS
}
