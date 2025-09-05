declare global {
  var GestureTestUtils: {
    simulatePanGesture?: Function;
    simulatePinchGesture?: Function;
    simulateTapGesture?: Function;
  } | undefined;
  
  var WorkletTestUtils: {
    createSharedValue?: Function;
    executeWorklet?: Function;
    runOnJS?: Function;
    resetContext?: Function;
  } | undefined;
  
  var createMockBeacon: Function | undefined;
  var createMockViewportState: Function | undefined;
  var createMockModuleContext: Function | undefined;
  
  var MockGestureHandler: any;
  var MockGestureDetector: any;
  var MockPinchGestureHandler: any;
  var MockPanGestureHandler: any;
  var MockTapGestureHandler: any;
  var MockRotationGestureHandler: any;
  var MockFlingGestureHandler: any;
  var MockLongPressGestureHandler: any;
}

// Extend CSSStyleDeclaration to include webkit properties
declare global {
  interface CSSStyleDeclaration {
    webkitTouchCallout?: string;
    webkitTapHighlightColor?: string;
    webkitUserDrag?: string;
    userDrag?: string;
  }
}

export {};