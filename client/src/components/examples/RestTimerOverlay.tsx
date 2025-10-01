import RestTimerOverlay from '../RestTimerOverlay'

export default function RestTimerOverlayExample() {
  return (
    <RestTimerOverlay 
      duration={10}
      onComplete={() => console.log('Rest complete')}
      onSkip={() => console.log('Rest skipped')}
    />
  )
}
