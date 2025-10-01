import QuestionnaireFlow from '../QuestionnaireFlow'

export default function QuestionnaireFlowExample() {
  return (
    <QuestionnaireFlow 
      onComplete={(data) => console.log('Questionnaire completed:', data)}
      onBack={() => console.log('Back clicked')}
    />
  )
}
