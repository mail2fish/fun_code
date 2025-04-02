import { createStore, compose, applyMiddleware,combineReducers } from 'redux';
import thunk from 'redux-thunk';
import { guiReducers } from 'scratch-gui';

const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
const rootReducer = combineReducers(guiReducers);

const store = createStore(
  rootReducer,
  composeEnhancers(applyMiddleware(thunk))
);

export default store;