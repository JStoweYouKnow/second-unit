import { createContext, useContext } from 'react'

/** Safe fallback if a consumer renders outside `AppContext.Provider` (e.g. HMR edge cases). */
const defaultAppContext = {
  favorites: [],
  toggleFavorite: () => {},
  allMessages: [],
  sendMessage: () => {},
  startConversation: () => undefined,
  markConversationRead: () => {},
  localProjects: [],
  createContract: async () => null,
  signContract: async () => null,
  signContractAsArtist: async () => null,
  payMilestone: async () => null,
  approveMilestone: async () => null,
  refetchContracts: () => {},
  realtimeConnected: false,
}

export const AppContext = createContext(defaultAppContext)

export function useApp() {
  return useContext(AppContext)
}
