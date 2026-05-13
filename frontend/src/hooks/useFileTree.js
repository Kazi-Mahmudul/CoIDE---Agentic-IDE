import { useState, useEffect, useCallback, useRef } from 'react'
import { getFileTree, getExternalTree } from '../api.js'

const POLL_INTERVAL = 3000 // Poll every 3 seconds to catch agent-created files

export function useFileTree(externalRoot = null) {
  const [tree, setTree] = useState([])
  const [loading, setLoading] = useState(false)
  const [rootPath, setRootPath] = useState(null)
  const pollTimer = useRef(null)
  const lastTreeHash = useRef('')

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      let data
      if (externalRoot) {
        data = await getExternalTree(externalRoot)
      } else {
        data = await getFileTree()
      }
      // Only update state if the tree actually changed (to avoid re-renders)
      const hash = JSON.stringify(data.tree)
      if (hash !== lastTreeHash.current) {
        lastTreeHash.current = hash
        setTree(data.tree || [])
        setRootPath(data.root || null)
      }
    } catch (e) {
      if (!/bearer token|token|unauthorized|401/i.test(String(e?.message || ''))) {
        console.error('Failed to load file tree:', e)
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [externalRoot])

  // Initial load
  useEffect(() => {
    refresh()
  }, [refresh])

  // Auto-poll to catch files created by the agent
  useEffect(() => {
    pollTimer.current = setInterval(() => refresh(true), POLL_INTERVAL)
    return () => clearInterval(pollTimer.current)
  }, [refresh])

  return { tree, loading, refresh, rootPath }
}
