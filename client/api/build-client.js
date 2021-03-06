import axios from 'axios';

export default ({ req }) => {
    if (typeof window === 'undefined') {
        // On the server
        return axios.create({
            baseURL:
                'http://ingress-nginx-controller.ingress-nginx.svc.cluster.local',
            headers: req.headers,
        });
    } else {
        // On the client
        return axios.create({
            baseURL: '/',
        });
    }
};
