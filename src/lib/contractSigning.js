/** Whether this user still needs to sign a pending contract. */
export function userNeedsToSign(contract, isArtist) {
  if (!contract || contract.status !== 'pending') return false
  return isArtist ? !contract.signedByArtist : !contract.signedByEmployer
}

/** Short copy explaining parallel (any-order) signing. */
export function contractSigningHint(contract, isArtist) {
  if (!userNeedsToSign(contract, isArtist)) return null
  const otherSigned = isArtist ? contract.signedByEmployer : contract.signedByArtist
  if (otherSigned) {
    return 'The other party has signed — add yours whenever you’re ready to activate the agreement.'
  }
  return 'Both parties can sign in any order. Milestones unlock once both signatures are on file.'
}
