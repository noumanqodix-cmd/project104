import SignUpPage from '../SignUpPage'

export default function SignUpPageExample() {
  return <SignUpPage onSignUp={(email, password) => console.log('Sign up:', email, password)} />
}
