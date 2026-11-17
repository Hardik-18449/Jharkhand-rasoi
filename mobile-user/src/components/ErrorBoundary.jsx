import React from "react";
import { View, StyleSheet } from "react-native";
import Txt from "./ui/Txt";
import Button from "./ui/Button";
import { palette } from "../theme";

/** App-level error boundary (web: shared/components/ErrorBoundary.jsx). Shows "something went wrong / retry". */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    // no PII logging
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.wrap}>
          <Txt weight={800} style={styles.title}>
            Something went wrong
          </Txt>
          <Txt weight={500} style={styles.desc}>
            An unexpected error occurred. Please try again.
          </Txt>
          <Button title="Retry" onPress={() => this.setState({ hasError: false })} style={{ marginTop: 20 }} />
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: palette.white },
  title: { fontSize: 20, color: palette.gray900 },
  desc: { fontSize: 14, color: palette.gray500, marginTop: 8, textAlign: "center" },
});
