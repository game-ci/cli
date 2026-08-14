import ImageTag from './image-tag';
declare const Docker: {
    build(buildParameters: any, silent?: boolean): Promise<ImageTag>;
    run(image: any, parameters: any, silent?: boolean): Promise<void>;
};
export default Docker;
