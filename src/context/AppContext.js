import { createContext, useContext } from 'react'

/** Safe fallback if a consumer renders outside `AppContext.Provider` (e.g. HMR edge cases). */
const defaultAppContext = {
  favorites: [],
  toggleFavorite: () => {},
  allMessages: [],
  sendMessage: () => {},
  startConversation: () => undefined,
  localProjects: [],
  setLocalProjects: () => {},
}

export const AppContext = createContext(defaultAppContext)

export function useApp() {
  return useContext(AppContext)
}
